package ru.teacherbox.homework.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.homework.domain.quiz.QuizAnswer;
import ru.teacherbox.homework.domain.quiz.QuizAttempt;

/** Attempts of students and their answers (ADR-0052). */
@Repository
public class QuizAttemptRepository {

    private final JdbcClient jdbc;

    public QuizAttemptRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(QuizAttempt attempt) {
        jdbc.sql("""
                insert into homework.quiz_attempts (id, task_id, started_at, submitted_at, score_points, max_points)
                values (:id, :taskId, :startedAt, :submittedAt, :scorePoints, :maxPoints)
                """)
                .param("id", attempt.id())
                .param("taskId", attempt.taskId())
                .param("startedAt", attempt.startedAt())
                .param("submittedAt", attempt.submittedAt())
                .param("scorePoints", attempt.scorePoints())
                .param("maxPoints", attempt.maxPoints())
                .update();
    }

    public Optional<QuizAttempt> findById(UUID id) {
        return jdbc.sql("""
                select id, task_id, started_at, submitted_at, score_points, max_points
                from homework.quiz_attempts where id = :id
                """)
                .param("id", id)
                .query(QuizAttemptRepository::map)
                .optional();
    }

    /** Oldest first. */
    public List<QuizAttempt> findByTask(UUID taskId) {
        return jdbc.sql("""
                select id, task_id, started_at, submitted_at, score_points, max_points
                from homework.quiz_attempts where task_id = :taskId order by started_at, id
                """)
                .param("taskId", taskId)
                .query(QuizAttemptRepository::map)
                .list();
    }

    /** Whether any student started an attempt - after that the questions are frozen. */
    public boolean existsForAssignment(UUID assignmentId) {
        return jdbc.sql("""
                select count(*) from homework.quiz_attempts a
                join homework.tasks t on t.id = a.task_id where t.assignment_id = :assignmentId
                """)
                .param("assignmentId", assignmentId)
                .query(Long.class)
                .single() > 0;
    }

    /** Closes the attempt with its score; the answers were saved with their verdicts before. */
    public void submit(UUID id, Instant submittedAt, int scorePoints, int maxPoints) {
        jdbc.sql("""
                update homework.quiz_attempts
                set submitted_at = :submittedAt, score_points = :scorePoints, max_points = :maxPoints where id = :id
                """)
                .param("id", id)
                .param("submittedAt", submittedAt)
                .param("scorePoints", scorePoints)
                .param("maxPoints", maxPoints)
                .update();
    }

    /** Inserts or replaces the answer to one question. */
    public void saveAnswer(QuizAnswer answer) {
        jdbc.sql("delete from homework.quiz_answers where attempt_id = :attemptId and question_id = :questionId")
                .param("attemptId", answer.attemptId())
                .param("questionId", answer.questionId())
                .update();
        jdbc.sql("""
                insert into homework.quiz_answers (attempt_id, question_id, answer, correct, points, overridden)
                values (:attemptId, :questionId, :answer, :correct, :points, :overridden)
                """)
                .param("attemptId", answer.attemptId())
                .param("questionId", answer.questionId())
                .param("answer", QuizCodec.answer(answer.answer()))
                .param("correct", answer.correct())
                .param("points", answer.points())
                .param("overridden", answer.overridden())
                .update();
    }

    public List<QuizAnswer> findAnswers(UUID attemptId) {
        return jdbc.sql("""
                select attempt_id, question_id, answer, correct, points, overridden
                from homework.quiz_answers where attempt_id = :attemptId
                """)
                .param("attemptId", attemptId)
                .query((rs, rowNum) -> new QuizAnswer(rs.getObject("attempt_id", UUID.class),
                        rs.getObject("question_id", UUID.class), QuizCodec.answer(rs.getString("answer")),
                        rs.getBoolean("correct"), rs.getInt("points"), rs.getBoolean("overridden")))
                .list();
    }

    private static QuizAttempt map(ResultSet rs, int rowNum) throws SQLException {
        int score = rs.getInt("score_points");
        Integer scorePoints = rs.wasNull() ? null : score;
        int max = rs.getInt("max_points");
        Integer maxPoints = rs.wasNull() ? null : max;
        return new QuizAttempt(rs.getObject("id", UUID.class), rs.getObject("task_id", UUID.class),
                rs.getObject("started_at", Instant.class), rs.getObject("submitted_at", Instant.class), scorePoints,
                maxPoints);
    }
}

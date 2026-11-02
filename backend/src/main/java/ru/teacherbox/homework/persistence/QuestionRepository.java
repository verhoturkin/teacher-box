package ru.teacherbox.homework.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.homework.domain.quiz.Question;
import ru.teacherbox.homework.domain.quiz.QuestionDraft;
import ru.teacherbox.homework.domain.quiz.QuestionType;

/** Questions of assignments (ADR-0052); they go with their assignment (cascade). */
@Repository
public class QuestionRepository {

    private final JdbcClient jdbc;

    public QuestionRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Puts these questions, in this order, in place of the assignment's ones. */
    public void replace(UUID assignmentId, List<QuestionDraft> questions) {
        jdbc.sql("delete from homework.assignment_questions where assignment_id = :assignmentId")
                .param("assignmentId", assignmentId)
                .update();
        int position = 0;
        for (QuestionDraft question : questions) {
            jdbc.sql("""
                    insert into homework.assignment_questions (id, assignment_id, position, type, text, options,
                        answer, points, explanation)
                    values (:id, :assignmentId, :position, :type, :text, :options, :answer, :points, :explanation)
                    """)
                    .param("id", question.id())
                    .param("assignmentId", assignmentId)
                    .param("position", position++)
                    .param("type", question.type().name())
                    .param("text", question.text())
                    .param("options", QuizCodec.options(question))
                    .param("answer", QuizCodec.key(question))
                    .param("points", question.points())
                    .param("explanation", question.explanation())
                    .update();
        }
    }

    /** In the teacher's order; only for an assignment that was given out, whose questions are complete. */
    public List<Question> findByAssignment(UUID assignmentId) {
        return findDrafts(assignmentId).stream().map(QuestionDraft::toQuestion).toList();
    }

    /** In the teacher's order, as typed: a draft assignment may hold incomplete ones (ADR-0054). */
    public List<QuestionDraft> findDrafts(UUID assignmentId) {
        return jdbc.sql("""
                select id, type, text, options, answer, points, explanation
                from homework.assignment_questions where assignment_id = :assignmentId order by position
                """)
                .param("assignmentId", assignmentId)
                .query(QuestionRepository::map)
                .list();
    }

    private static QuestionDraft map(ResultSet rs, int rowNum) throws SQLException {
        return QuizCodec.question(rs.getObject("id", UUID.class), QuestionType.valueOf(rs.getString("type")),
                rs.getString("text"), rs.getInt("points"), rs.getString("explanation"), rs.getString("options"),
                rs.getString("answer"));
    }

    /** How many questions every assignment has (assignments with none are absent). */
    public Map<UUID, Integer> countsByAssignment() {
        Map<UUID, Integer> counts = new HashMap<>();
        jdbc.sql("select assignment_id, count(*) as total from homework.assignment_questions group by assignment_id")
                .query((ResultSet rs) -> {
                    counts.put(rs.getObject("assignment_id", UUID.class), rs.getInt("total"));
                });
        return counts;
    }
}

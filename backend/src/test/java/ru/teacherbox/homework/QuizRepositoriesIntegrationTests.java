package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.teacherbox.homework.domain.quiz.Answer;
import ru.teacherbox.homework.domain.quiz.Matching;
import ru.teacherbox.homework.domain.quiz.MultipleChoice;
import ru.teacherbox.homework.domain.quiz.Numeric;
import ru.teacherbox.homework.domain.quiz.Option;
import ru.teacherbox.homework.domain.quiz.Ordering;
import ru.teacherbox.homework.domain.quiz.Pair;
import ru.teacherbox.homework.domain.quiz.Question;
import ru.teacherbox.homework.domain.quiz.QuizAnswer;
import ru.teacherbox.homework.domain.quiz.QuizAttempt;
import ru.teacherbox.homework.domain.quiz.ShortText;
import ru.teacherbox.homework.domain.quiz.SingleChoice;
import ru.teacherbox.homework.persistence.QuestionRepository;
import ru.teacherbox.homework.persistence.QuizAttemptRepository;

/** Questions, attempts and answers in the real schema (ADR-0052). */
@HomeworkIntegrationTest
class QuizRepositoriesIntegrationTests {

    @Autowired
    QuestionRepository questions;

    @Autowired
    QuizAttemptRepository attempts;

    @Autowired
    JdbcClient jdbc;

    @Test
    void questionsRoundTripInOrderAndAreReplaced() {
        UUID assignment = assignment();
        Option a = new Option(UUID.randomUUID(), "A");
        Option b = new Option(UUID.randomUUID(), "B");
        Pair pair = new Pair(UUID.randomUUID(), "1", "one");
        Pair pair2 = new Pair(UUID.randomUUID(), "2", "two");
        List<Question> all = List.of(
                new SingleChoice(UUID.randomUUID(), "Single", 2, "because", List.of(a, b), b.id()),
                new MultipleChoice(UUID.randomUUID(), "Multi", 1, null, List.of(a, b), Set.of(a.id(), b.id())),
                new ShortText(UUID.randomUUID(), "Short", 1, null, List.of("Берёза", "birch")),
                new Numeric(UUID.randomUUID(), "Num", 3, null, new BigDecimal("2.50"), new BigDecimal("0.1")),
                new Matching(UUID.randomUUID(), "Match", 1, null, List.of(pair, pair2)),
                new Ordering(UUID.randomUUID(), "Order", 1, null, List.of(a, b)));

        questions.replace(assignment, all);

        assertThat(questions.findByAssignment(assignment)).isEqualTo(all);

        questions.replace(assignment, all.subList(0, 1));
        assertThat(questions.findByAssignment(assignment)).containsExactly(all.getFirst());
        assertThat(questions.findByAssignment(UUID.randomUUID())).isEmpty();
    }

    @Test
    void attemptsAndAnswersRoundTrip() {
        UUID assignment = assignment();
        UUID task = task(assignment);
        assertThat(attempts.existsForAssignment(assignment)).isFalse();
        Option a = new Option(UUID.randomUUID(), "A");
        Option b = new Option(UUID.randomUUID(), "B");
        Question q1 = new SingleChoice(UUID.randomUUID(), "Q1", 2, null, List.of(a, b), a.id());
        Question q2 = new ShortText(UUID.randomUUID(), "Q2", 1, null, List.of("x"));
        Question q3 = new Numeric(UUID.randomUUID(), "Q3", 1, null, BigDecimal.TEN, BigDecimal.ZERO);
        Question q4 = new Ordering(UUID.randomUUID(), "Q4", 1, null, List.of(a, b));
        UUID pairId = UUID.randomUUID();
        Question q5 = new Matching(UUID.randomUUID(), "Q5", 1, null,
                List.of(new Pair(pairId, "l", "r"), new Pair(UUID.randomUUID(), "l2", "r2")));
        questions.replace(assignment, List.of(q1, q2, q3, q4, q5));

        Instant start = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        QuizAttempt attempt = new QuizAttempt(UUID.randomUUID(), task, start, null, null, null);
        attempts.insert(attempt);
        assertThat(attempts.existsForAssignment(assignment)).isTrue();
        assertThat(attempts.findById(attempt.id())).contains(attempt);
        assertThat(attempts.findById(UUID.randomUUID())).isEmpty();

        attempts.saveAnswer(new QuizAnswer(attempt.id(), q1.id(), new Answer.Choice(Set.of(b.id())), false, 0, false));
        attempts.saveAnswer(new QuizAnswer(attempt.id(), q1.id(), new Answer.Choice(Set.of(a.id())), true, 2, false));
        attempts.saveAnswer(new QuizAnswer(attempt.id(), q2.id(), new Answer.Text("X"), true, 1, true));
        attempts.saveAnswer(new QuizAnswer(attempt.id(), q3.id(), new Answer.Number(new BigDecimal("10.0")), true, 1,
                false));
        attempts.saveAnswer(new QuizAnswer(attempt.id(), q4.id(), new Answer.Order(List.of(b.id(), a.id())), false, 0,
                false));
        attempts.saveAnswer(new QuizAnswer(attempt.id(), q5.id(), new Answer.Pairs(Map.of(pairId, pairId)), false, 0,
                false));

        assertThat(attempts.findAnswers(attempt.id())).hasSize(5)
                .contains(new QuizAnswer(attempt.id(), q1.id(), new Answer.Choice(Set.of(a.id())), true, 2, false),
                        new QuizAnswer(attempt.id(), q2.id(), new Answer.Text("X"), true, 1, true),
                        new QuizAnswer(attempt.id(), q4.id(), new Answer.Order(List.of(b.id(), a.id())), false, 0,
                                false));

        Instant end = start.plusSeconds(60);
        attempts.submit(attempt.id(), end, 4, 6);
        QuizAttempt second = new QuizAttempt(UUID.randomUUID(), task, end.plusSeconds(1), null, null, null);
        attempts.insert(second);

        assertThat(attempts.findByTask(task)).containsExactly(
                new QuizAttempt(attempt.id(), task, start, end, 4, 6), second);
    }

    @Test
    void deletingQuestionsRemovesTheirAnswers() {
        UUID assignment = assignment();
        UUID task = task(assignment);
        Question q = new ShortText(UUID.randomUUID(), "Q", 1, null, List.of("x"));
        questions.replace(assignment, List.of(q));
        QuizAttempt attempt = new QuizAttempt(UUID.randomUUID(), task, Instant.now(), null, null, null);
        attempts.insert(attempt);
        attempts.saveAnswer(new QuizAnswer(attempt.id(), q.id(), new Answer.Text("x"), true, 1, false));

        questions.replace(assignment, List.of());

        assertThat(attempts.findAnswers(attempt.id())).isEmpty();
    }

    private UUID assignment() {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                insert into homework.assignments (id, title, created_at, updated_at, version)
                values (:id, 'Quiz', now(), now(), 0)
                """).param("id", id).update();
        return id;
    }

    private UUID task(UUID assignment) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                insert into homework.tasks (id, assignment_id, student_id, status, assigned_at, version)
                values (:id, :assignment, :student, 'ASSIGNED', now(), 0)
                """).param("id", id).param("assignment", assignment).param("student", UUID.randomUUID()).update();
        return id;
    }
}

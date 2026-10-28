package ru.teacherbox.homework.domain.quiz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import ru.teacherbox.shared.error.BusinessRuleException;

class QuestionTest {

    private static final Option A = new Option(UUID.randomUUID(), "A");
    private static final Option B = new Option(UUID.randomUUID(), "B");
    private static final Option C = new Option(UUID.randomUUID(), "C");

    @ParameterizedTest
    @CsvSource({"Paris, true", "'  PARIS ', true", "paris, true", "Лондон, false", "'', false"})
    void shortTextIgnoresCaseAndSpaces(String given, boolean right) {
        var q = new ShortText(UUID.randomUUID(), "Capital?", 1, null, List.of("Paris"));
        assertThat(q.check(new Answer.Text(given))).isEqualTo(right);
    }

    @Test
    void shortTextTreatsYoAsYeAndCollapsesSpaces() {
        var q = new ShortText(UUID.randomUUID(), "Q", 1, null, List.of("Берёзовая  роща", "ёлка"));
        assertThat(q.check(new Answer.Text(" березовая роща "))).isTrue();
        assertThat(q.check(new Answer.Text("Елка"))).isTrue();
        assertThat(q.check(new Answer.Number(BigDecimal.ONE))).isFalse();
    }

    @ParameterizedTest
    @CsvSource({"3.14, true", "3.19, true", "3.2, false", "3.08, false", "3.1, true"})
    void numericUsesTolerance(String given, boolean right) {
        var q = new Numeric(UUID.randomUUID(), "pi", 1, null, new BigDecimal("3.14"), new BigDecimal("0.05"));
        assertThat(q.check(new Answer.Number(new BigDecimal(given)))).isEqualTo(right);
    }

    @Test
    void singleChoiceAcceptsExactlyTheKey() {
        var q = new SingleChoice(UUID.randomUUID(), "Q", 2, "why", List.of(A, B, C), B.id());
        assertThat(q.check(new Answer.Choice(Set.of(B.id())))).isTrue();
        assertThat(q.check(new Answer.Choice(Set.of(A.id())))).isFalse();
        assertThat(q.check(new Answer.Choice(Set.of(A.id(), B.id())))).isFalse();
        assertThat(q.check(new Answer.Text("B"))).isFalse();
    }

    @Test
    void multipleChoiceNeedsTheExactSet() {
        var q = new MultipleChoice(UUID.randomUUID(), "Q", 1, null, List.of(A, B, C), Set.of(A.id(), C.id()));
        assertThat(q.check(new Answer.Choice(Set.of(C.id(), A.id())))).isTrue();
        assertThat(q.check(new Answer.Choice(Set.of(A.id())))).isFalse();
        assertThat(q.check(new Answer.Choice(Set.of(A.id(), B.id(), C.id())))).isFalse();
    }

    @Test
    void matchingNeedsEveryPair() {
        var p1 = new Pair(UUID.randomUUID(), "1", "one");
        var p2 = new Pair(UUID.randomUUID(), "2", "two");
        var q = new Matching(UUID.randomUUID(), "Q", 1, null, List.of(p1, p2));
        assertThat(q.check(new Answer.Pairs(Map.of(p1.id(), p1.id(), p2.id(), p2.id())))).isTrue();
        assertThat(q.check(new Answer.Pairs(Map.of(p1.id(), p2.id(), p2.id(), p1.id())))).isFalse();
        assertThat(q.check(new Answer.Pairs(Map.of(p1.id(), p1.id())))).isFalse();
    }

    @Test
    void orderingNeedsTheSameSequence() {
        var q = new Ordering(UUID.randomUUID(), "Q", 1, null, List.of(A, B, C));
        assertThat(q.check(new Answer.Order(List.of(A.id(), B.id(), C.id())))).isTrue();
        assertThat(q.check(new Answer.Order(List.of(B.id(), A.id(), C.id())))).isFalse();
    }

    @Test
    void typesAreReported() {
        assertThat(new SingleChoice(UUID.randomUUID(), "Q", 1, null, List.of(A, B), A.id()).type())
                .isEqualTo(QuestionType.SINGLE_CHOICE);
        assertThat(new Ordering(UUID.randomUUID(), "Q", 1, null, List.of(A, B)).type())
                .isEqualTo(QuestionType.ORDERING);
    }

    @Test
    void validationRefusesBadQuestions() {
        UUID id = UUID.randomUUID();
        var dup = new Option(A.id(), "dup");
        assertCode("homework.quiz-text-invalid", () -> new SingleChoice(id, " ", 1, null, List.of(A, B), A.id()));
        assertCode("homework.quiz-text-invalid",
                () -> new SingleChoice(id, "x".repeat(2001), 1, null, List.of(A, B), A.id()));
        assertCode("homework.quiz-points-invalid", () -> new SingleChoice(id, "Q", 0, null, List.of(A, B), A.id()));
        assertCode("homework.quiz-points-invalid", () -> new SingleChoice(id, "Q", 101, null, List.of(A, B), A.id()));
        assertCode("homework.quiz-options-count", () -> new SingleChoice(id, "Q", 1, null, List.of(A), A.id()));
        assertCode("homework.quiz-options-count", () -> new Ordering(id, "Q", 1, null, options(11)));
        assertCode("homework.quiz-duplicate-id", () -> new SingleChoice(id, "Q", 1, null, List.of(A, dup), A.id()));
        assertCode("homework.quiz-no-correct",
                () -> new SingleChoice(id, "Q", 1, null, List.of(A, B), UUID.randomUUID()));
        assertCode("homework.quiz-no-correct", () -> new MultipleChoice(id, "Q", 1, null, List.of(A, B), Set.of()));
        assertCode("homework.quiz-no-correct",
                () -> new MultipleChoice(id, "Q", 1, null, List.of(A, B), Set.of(C.id())));
        assertCode("homework.quiz-option-invalid", () -> new Option(id, " "));
        assertCode("homework.quiz-option-invalid", () -> new Pair(id, "l", ""));
        assertCode("homework.quiz-options-count", () -> new ShortText(id, "Q", 1, null, List.of()));
        assertCode("homework.quiz-options-count",
                () -> new ShortText(id, "Q", 1, null, IntStream.range(0, 11).mapToObj(Integer::toString).toList()));
        assertCode("homework.quiz-tolerance-invalid",
                () -> new Numeric(id, "Q", 1, null, BigDecimal.ONE, new BigDecimal("-1")));
        assertCode("homework.quiz-options-count",
                () -> new Matching(id, "Q", 1, null, List.of(new Pair(id, "l", "r"))));
        assertCode("homework.quiz-text-invalid", () -> new Ordering(id, "Q", 1, "x".repeat(2001), List.of(A, B)));
    }

    @Test
    void quizLimits() {
        var one = new Ordering(UUID.randomUUID(), "Q", 3, null, List.of(A, B));
        var two = new Ordering(UUID.randomUUID(), "Q", 3, null, List.of(A, B));
        Quiz.requireValid(List.of(one, two));
        assertThat(Quiz.maxPoints(List.of(one, two))).isEqualTo(6);
        assertCode("homework.quiz-duplicate-id", () -> Quiz.requireValid(List.of(one, one)));
        List<Question> many = IntStream.range(0, 51)
                .<Question>mapToObj(i -> new Ordering(UUID.randomUUID(), "Q", 1, null, List.of(A, B))).toList();
        assertCode("homework.quiz-too-many-questions", () -> Quiz.requireValid(many));
    }

    private static List<Option> options(int n) {
        return IntStream.range(0, n).mapToObj(i -> new Option(UUID.randomUUID(), "o" + i)).toList();
    }

    private static void assertCode(String code, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(BusinessRuleException.class,
                e -> assertThat(e.code()).isEqualTo(code));
    }
}

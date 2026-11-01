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
        Quiz.requireValid(List.of(QuestionDraft.of(one), QuestionDraft.of(two)));
        assertThat(Quiz.maxPoints(List.of(one, two))).isEqualTo(6);
        assertCode("homework.quiz-duplicate-id",
                () -> Quiz.requireValid(List.of(QuestionDraft.of(one), QuestionDraft.of(one))));
        List<QuestionDraft> many = IntStream.range(0, 51)
                .mapToObj(i -> QuestionDraft.of(new Ordering(UUID.randomUUID(), "Q", 1, null, List.of(A, B))))
                .toList();
        assertCode("homework.quiz-too-many-questions", () -> Quiz.requireValid(many));
    }

    @Test
    void draftsRoundTripEveryType() {
        List<Question> all = List.of(
                new SingleChoice(UUID.randomUUID(), "S", 2, "why", List.of(A, B), B.id()),
                new MultipleChoice(UUID.randomUUID(), "M", 1, null, List.of(A, B, C), Set.of(A.id(), C.id())),
                new ShortText(UUID.randomUUID(), "T", 1, null, List.of("x")),
                new Numeric(UUID.randomUUID(), "N", 1, null, BigDecimal.TEN, BigDecimal.ONE),
                new Matching(UUID.randomUUID(), "P", 1, null,
                        List.of(new Pair(UUID.randomUUID(), "l", "r"), new Pair(UUID.randomUUID(), "l2", "r2"))),
                new Ordering(UUID.randomUUID(), "O", 1, null, List.of(A, B)));

        assertThat(all.stream().map(q -> QuestionDraft.of(q).toQuestion()).toList()).isEqualTo(all);
        assertThat(QuestionDraft.of(all.get(1)).correct()).containsExactly(A.id(), C.id());
        UUID other = UUID.randomUUID();
        assertThat(QuestionDraft.of(all.getFirst()).withId(other).toQuestion().id()).isEqualTo(other);
    }

    @Test
    void draftKeepsIncompleteQuestionsButNotWhatCannotBeStored() {
        UUID id = UUID.randomUUID();
        var empty = new QuestionDraft(id, QuestionType.SINGLE_CHOICE, "", 1, " ",
                List.of(new QuestionDraft.Item(id, "")), List.of(), List.of(), null, null, List.of());
        assertThat(empty.explanation()).isNull();
        assertCode("homework.quiz-text-invalid", empty::toQuestion);
        var number = draft(QuestionType.NUMBER, "Q", List.of(), List.of());
        assertThat(number.tolerance()).isEqualTo(BigDecimal.ZERO);
        assertCode("homework.quiz-value-missing", number::toQuestion);
        assertCode("homework.quiz-no-correct", () -> draft(QuestionType.SINGLE_CHOICE, "Q",
                List.of(new QuestionDraft.Item(A.id(), "a"), new QuestionDraft.Item(B.id(), "b")), List.of())
                .toQuestion());

        assertCode("homework.quiz-text-invalid",
                () -> draft(QuestionType.ORDERING, "x".repeat(2001), List.of(), List.of()));
        assertCode("homework.quiz-text-invalid", () -> new QuestionDraft(id, QuestionType.ORDERING, "Q", 1,
                "x".repeat(2001), List.of(), List.of(), List.of(), null, null, List.of()));
        assertCode("homework.quiz-points-invalid", () -> new QuestionDraft(id, QuestionType.ORDERING, "Q", 0, null,
                List.of(), List.of(), List.of(), null, null, List.of()));
        assertCode("homework.quiz-option-invalid", () -> new QuestionDraft.Item(id, "x".repeat(501)));
        assertCode("homework.quiz-option-invalid", () -> new QuestionDraft.Match(id, "", "x".repeat(501)));
        assertCode("homework.quiz-option-invalid", () -> new QuestionDraft.Match(id, "x".repeat(501), ""));
        assertCode("homework.quiz-options-count", () -> draft(QuestionType.ORDERING, "Q",
                IntStream.range(0, 11).mapToObj(i -> new QuestionDraft.Item(UUID.randomUUID(), "")).toList(),
                List.of()));
        assertCode("homework.quiz-options-count", () -> draft(QuestionType.SHORT_TEXT, "Q", List.of(),
                IntStream.range(0, 11).mapToObj(i -> "a").toList()));
        assertCode("homework.quiz-option-invalid",
                () -> draft(QuestionType.SHORT_TEXT, "Q", List.of(), List.of("x".repeat(201))));
        assertCode("homework.quiz-options-count", () -> new QuestionDraft(id, QuestionType.MATCHING, "Q", 1, null,
                List.of(), List.of(), List.of(), null, null,
                IntStream.range(0, 11).mapToObj(i -> new QuestionDraft.Match(UUID.randomUUID(), "", "")).toList()));
    }

    @Test
    void completeQuizNamesEveryBrokenQuestion() {
        var good = QuestionDraft.of(new Ordering(UUID.randomUUID(), "Q", 1, null, List.of(A, B)));
        var noText = draft(QuestionType.SHORT_TEXT, " ", List.of(), List.of("a"));
        var noValue = draft(QuestionType.NUMBER, "Q", List.of(), List.of());

        assertThat(Quiz.requireComplete(List.of(good))).containsExactly(good.toQuestion());
        assertThatThrownBy(() -> Quiz.requireComplete(List.of(good, noText, noValue)))
                .isInstanceOfSatisfying(BusinessRuleException.class, e -> {
                    assertThat(e.code()).isEqualTo("homework.quiz-incomplete");
                    assertThat(e.properties()).containsEntry("questions", List.of(
                            new Quiz.Problem(2, "homework.quiz-text-invalid"),
                            new Quiz.Problem(3, "homework.quiz-value-missing")));
                });
        assertCode("homework.quiz-duplicate-id", () -> Quiz.requireComplete(List.of(good, good)));
    }

    private static QuestionDraft draft(QuestionType type, String text, List<QuestionDraft.Item> options,
            List<String> accepted) {
        return new QuestionDraft(UUID.randomUUID(), type, text, 1, null, options, List.of(), accepted, null, null,
                List.of());
    }

    private static List<Option> options(int n) {
        return IntStream.range(0, n).mapToObj(i -> new Option(UUID.randomUUID(), "o" + i)).toList();
    }

    private static void assertCode(String code, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(BusinessRuleException.class,
                e -> assertThat(e.code()).isEqualTo(code));
    }
}

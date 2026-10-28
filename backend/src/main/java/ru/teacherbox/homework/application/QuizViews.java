package ru.teacherbox.homework.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.homework.application.HomeworkViews.QuestionView;
import ru.teacherbox.homework.domain.quiz.Answer;
import ru.teacherbox.homework.domain.quiz.Matching;
import ru.teacherbox.homework.domain.quiz.Numeric;
import ru.teacherbox.homework.domain.quiz.Ordering;
import ru.teacherbox.homework.domain.quiz.Question;
import ru.teacherbox.homework.domain.quiz.QuestionType;
import ru.teacherbox.homework.domain.quiz.RevealRule;
import ru.teacherbox.homework.domain.quiz.ShortText;
import ru.teacherbox.shared.error.BusinessRuleException;

/** The quiz as the student sees it (ADR-0052): no key until the reveal rule allows it. */
public final class QuizViews {

    private QuizViews() {
    }

    /** An option, an ordering item or one side of a matching pair. */
    public record Item(UUID id, String text) {
    }

    /**
     * A question without the key; options, items and the right column of a matching are shuffled.
     *
     * @param options choices or the items of an ordering
     * @param left    left sides of a matching, in the teacher's order
     * @param right   right sides of a matching (ids are the pair ids)
     */
    public record QuizQuestion(UUID id, QuestionType type, String text, int points, List<Item> options,
            List<Item> left, List<Item> right) {
    }

    /**
     * The student's answer, one shape for the request and the view; which field is used depends on the question
     * type: {@code ids} (choice, ordering), {@code text}, {@code number}, {@code pairs} (left id → right id).
     */
    public record AnswerInput(@Nullable List<UUID> ids, @Nullable String text, @Nullable BigDecimal number,
            @Nullable Map<UUID, UUID> pairs) {

        private static final int MAX_IDS = 50;

        static AnswerInput of(Answer answer) {
            return switch (answer) {
                case Answer.Choice a -> new AnswerInput(List.copyOf(a.ids()), null, null, null);
                case Answer.Order a -> new AnswerInput(a.ids(), null, null, null);
                case Answer.Text a -> new AnswerInput(null, a.value(), null, null);
                case Answer.Number a -> new AnswerInput(null, null, a.value(), null);
                case Answer.Pairs a -> new AnswerInput(null, null, null, a.matches());
            };
        }

        Answer toAnswer(Question question) {
            boolean ok = switch (question) {
                case ShortText q -> text != null && text.length() <= Question.MAX_TEXT;
                case Numeric q -> number != null;
                case Matching q -> pairs != null && pairs.size() <= MAX_IDS;
                default -> ids != null && ids.size() <= MAX_IDS;
            };
            if (!ok) {
                throw new BusinessRuleException("homework.quiz-answer-invalid", "The answer does not fit the question");
            }
            return switch (question) {
                case ShortText q -> new Answer.Text(text);
                case Numeric q -> new Answer.Number(number);
                case Matching q -> new Answer.Pairs(pairs);
                case Ordering q -> new Answer.Order(ids);
                default -> new Answer.Choice(new LinkedHashSet<>(ids));
            };
        }
    }

    public record AttemptView(UUID id, Instant startedAt, @Nullable Instant submittedAt,
            @Nullable Integer scorePoints, @Nullable Integer maxPoints) {
    }

    /** An attempt in progress with the answers saved so far (question id → answer). */
    public record OpenAttempt(UUID id, Instant startedAt, Map<UUID, AnswerInput> answers) {
    }

    /** One question of the best attempt with the key and the student's answer; only after the reveal. */
    public record QuestionResult(QuestionView question, @Nullable AnswerInput answer, boolean correct, int points) {
    }

    /**
     * @param attemptsAllowed {@code null} — unlimited
     * @param attemptsLeft    {@code null} — unlimited
     * @param best            the best submitted attempt (earliest on a tie), {@code null} — none yet
     * @param results         {@code null} until the reveal rule allows showing the key
     */
    public record QuizView(List<QuizQuestion> questions, int maxPoints, RevealRule reveal,
            @Nullable Integer attemptsAllowed, int attemptsUsed, @Nullable Integer attemptsLeft, boolean canStart,
            @Nullable OpenAttempt openAttempt, List<AttemptView> attempts, @Nullable AttemptView best,
            @Nullable List<QuestionResult> results) {
    }
}

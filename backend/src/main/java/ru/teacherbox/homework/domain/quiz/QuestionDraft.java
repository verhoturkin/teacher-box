package ru.teacherbox.homework.domain.quiz;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * A question as the teacher typed it (ADR-0054): a draft assignment keeps it incomplete, {@link #toQuestion()} applies
 * the rules of its type when the assignment is given out. Only what cannot be stored — too long, too many, points out
 * of range — is refused at once. Which fields count depends on the type, as in {@link Question}.
 *
 * @param options choices of a single / multiple choice, items of an ordering in the right order
 * @param correct ids of the right options
 */
public record QuestionDraft(UUID id, QuestionType type, String text, int points, @Nullable String explanation,
        List<Item> options, List<UUID> correct, List<String> accepted, @Nullable BigDecimal value,
        @Nullable BigDecimal tolerance, List<Match> pairs) {

    /** An option or an ordering item, possibly empty. */
    public record Item(UUID id, String text) {

        public Item {
            length(text, Question.MAX_ITEM_TEXT, "homework.quiz-option-invalid");
        }
    }

    /** A matching pair, possibly half filled. */
    public record Match(UUID id, String left, String right) {

        public Match {
            length(left, Question.MAX_ITEM_TEXT, "homework.quiz-option-invalid");
            length(right, Question.MAX_ITEM_TEXT, "homework.quiz-option-invalid");
        }
    }

    public QuestionDraft {
        length(text, Question.MAX_TEXT, "homework.quiz-text-invalid");
        explanation = explanation == null || explanation.isBlank() ? null : explanation;
        if (explanation != null) {
            length(explanation, Question.MAX_TEXT, "homework.quiz-text-invalid");
        }
        points = Rules.points(points);
        if (type == QuestionType.NUMBER && tolerance == null) {
            tolerance = BigDecimal.ZERO;
        }
        options = List.copyOf(options);
        correct = List.copyOf(correct);
        accepted = List.copyOf(accepted);
        pairs = List.copyOf(pairs);
        if (options.size() > Question.MAX_ITEMS || pairs.size() > Question.MAX_ITEMS
                || accepted.size() > ShortText.MAX_ACCEPTED) {
            throw new BusinessRuleException("homework.quiz-options-count", "Too many options in a question");
        }
        accepted.forEach(a -> length(a, ShortText.MAX_ACCEPTED_LENGTH, "homework.quiz-option-invalid"));
    }

    /** The same question as a draft. */
    public static QuestionDraft of(Question q) {
        List<Item> options = List.of();
        List<UUID> correct = List.of();
        List<String> accepted = List.of();
        BigDecimal value = null;
        BigDecimal tolerance = null;
        List<Match> pairs = List.of();
        switch (q) {
            case SingleChoice s -> {
                options = items(s.options());
                correct = List.of(s.correct());
            }
            case MultipleChoice m -> {
                options = items(m.options());
                correct = m.options().stream().map(Option::id).filter(m.correct()::contains).toList();
            }
            case ShortText t -> accepted = t.accepted();
            case Numeric n -> {
                value = n.value();
                tolerance = n.tolerance();
            }
            case Matching m -> pairs = m.pairs().stream().map(p -> new Match(p.id(), p.left(), p.right())).toList();
            case Ordering o -> options = items(o.items());
        }
        return new QuestionDraft(q.id(), q.type(), q.text(), q.points(), q.explanation(), options, correct, accepted,
                value, tolerance, pairs);
    }

    /** The same draft with another id, for a copy of the assignment. */
    public QuestionDraft withId(UUID newId) {
        return new QuestionDraft(newId, type, text, points, explanation, options, correct, accepted, value, tolerance,
                pairs);
    }

    /**
     * The question by the rules of its type.
     *
     * @throws BusinessRuleException {@code homework.quiz-*} for an incomplete or invalid question
     */
    public Question toQuestion() {
        Rules.text(text, Question.MAX_TEXT, "homework.quiz-text-invalid"); // the question first, then its options
        List<Option> optionList = options.stream().map(o -> new Option(o.id(), o.text())).toList();
        return switch (type) {
            case SINGLE_CHOICE -> new SingleChoice(id, text, points, explanation, optionList,
                    correct.size() == 1 ? correct.getFirst() : noCorrect());
            case MULTIPLE_CHOICE -> new MultipleChoice(id, text, points, explanation, optionList,
                    new LinkedHashSet<>(correct));
            case SHORT_TEXT -> new ShortText(id, text, points, explanation, accepted);
            case NUMBER -> new Numeric(id, text, points, explanation, value == null ? noValue() : value,
                    tolerance == null ? BigDecimal.ZERO : tolerance);
            case MATCHING -> new Matching(id, text, points, explanation,
                    pairs.stream().map(p -> new Pair(p.id(), p.left(), p.right())).toList());
            case ORDERING -> new Ordering(id, text, points, explanation, optionList);
        };
    }

    private static List<Item> items(List<Option> options) {
        return options.stream().map(o -> new Item(o.id(), o.text())).toList();
    }

    private static void length(String text, int max, String code) {
        if (text.strip().length() > max) {
            throw new BusinessRuleException(code, "Quiz text is longer than " + max);
        }
    }

    private static UUID noCorrect() {
        throw new BusinessRuleException("homework.quiz-no-correct", "A single choice needs one correct option");
    }

    private static BigDecimal noValue() {
        throw new BusinessRuleException("homework.quiz-value-missing", "A number question needs a value");
    }
}

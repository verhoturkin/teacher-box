package ru.teacherbox.homework.domain.quiz;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Several accepted answers; compared after {@link #normalize}. */
public record ShortText(UUID id, String text, int points, @Nullable String explanation, List<String> accepted)
        implements Question {

    public static final int MAX_ACCEPTED = 10;
    public static final int MAX_ACCEPTED_LENGTH = 200;

    public ShortText {
        text = Rules.text(text, MAX_TEXT, "homework.quiz-text-invalid");
        points = Rules.points(points);
        explanation = Rules.explanation(explanation);
        accepted = accepted.stream().map(a -> Rules.text(a, MAX_ACCEPTED_LENGTH, "homework.quiz-option-invalid"))
                .toList();
        if (accepted.isEmpty() || accepted.size() > MAX_ACCEPTED) {
            throw new BusinessRuleException("homework.quiz-options-count", "A question needs 1..10 accepted answers");
        }
    }

    /** Trim, collapse spaces, ignore case, {@code ё} = {@code е}. */
    public static String normalize(String value) {
        return value.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT).replace('ё', 'е');
    }

    @Override
    public QuestionType type() {
        return QuestionType.SHORT_TEXT;
    }

    @Override
    public boolean check(Answer answer) {
        if (!(answer instanceof Answer.Text given)) {
            return false;
        }
        String actual = normalize(given.value());
        return accepted.stream().anyMatch(a -> normalize(a).equals(actual));
    }
}

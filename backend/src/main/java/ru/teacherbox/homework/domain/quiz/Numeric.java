package ru.teacherbox.homework.domain.quiz;

import java.math.BigDecimal;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/** A number within {@code ± tolerance} of the value. */
public record Numeric(UUID id, String text, int points, @Nullable String explanation, BigDecimal value,
        BigDecimal tolerance) implements Question {

    public Numeric {
        text = Rules.text(text, MAX_TEXT, "homework.quiz-text-invalid");
        points = Rules.points(points);
        explanation = Rules.explanation(explanation);
        if (tolerance.signum() < 0) {
            throw new BusinessRuleException("homework.quiz-tolerance-invalid", "Tolerance cannot be negative");
        }
    }

    @Override
    public QuestionType type() {
        return QuestionType.NUMBER;
    }

    @Override
    public boolean check(Answer answer) {
        return answer instanceof Answer.Number given && value.subtract(given.value()).abs().compareTo(tolerance) <= 0;
    }
}

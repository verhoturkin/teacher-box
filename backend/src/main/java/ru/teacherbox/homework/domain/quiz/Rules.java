package ru.teacherbox.homework.domain.quiz;

import java.util.Collection;
import java.util.HashSet;
import java.util.UUID;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Validation shared by the question types. */
final class Rules {

    private Rules() {
    }

    static String text(@Nullable String text, int max, String code) {
        if (text == null || text.isBlank() || text.strip().length() > max) {
            throw new BusinessRuleException(code, "Quiz text is empty or longer than " + max);
        }
        return text.strip();
    }

    static @Nullable String explanation(@Nullable String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        return text(text, Question.MAX_TEXT, "homework.quiz-text-invalid");
    }

    static int points(int points) {
        if (points < 1 || points > Question.MAX_POINTS) {
            throw new BusinessRuleException("homework.quiz-points-invalid", "Points must be 1.." + Question.MAX_POINTS);
        }
        return points;
    }

    static void count(int size) {
        if (size < Question.MIN_ITEMS || size > Question.MAX_ITEMS) {
            throw new BusinessRuleException("homework.quiz-options-count",
                    "A question needs " + Question.MIN_ITEMS + ".." + Question.MAX_ITEMS + " options");
        }
    }

    static <T> void unique(Collection<T> items, Function<T, UUID> id) {
        var seen = new HashSet<UUID>();
        for (T item : items) {
            if (!seen.add(id.apply(item))) {
                throw new BusinessRuleException("homework.quiz-duplicate-id", "Duplicate id in a quiz");
            }
        }
    }
}

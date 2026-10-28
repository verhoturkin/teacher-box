package ru.teacherbox.homework.domain.quiz;

import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Items listed in the right order; the student sees them shuffled. */
public record Ordering(UUID id, String text, int points, @Nullable String explanation, List<Option> items)
        implements Question {

    public Ordering {
        text = Rules.text(text, MAX_TEXT, "homework.quiz-text-invalid");
        points = Rules.points(points);
        explanation = Rules.explanation(explanation);
        items = List.copyOf(items);
        Rules.count(items.size());
        Rules.unique(items, Option::id);
    }

    @Override
    public QuestionType type() {
        return QuestionType.ORDERING;
    }

    @Override
    public boolean check(Answer answer) {
        return answer instanceof Answer.Order given && given.ids().equals(items.stream().map(Option::id).toList());
    }
}

package ru.teacherbox.homework.domain.quiz;

import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Every left side matched to its own right side; all or nothing. */
public record Matching(UUID id, String text, int points, @Nullable String explanation, List<Pair> pairs)
        implements Question {

    public Matching {
        text = Rules.text(text, MAX_TEXT, "homework.quiz-text-invalid");
        points = Rules.points(points);
        explanation = Rules.explanation(explanation);
        pairs = List.copyOf(pairs);
        Rules.count(pairs.size());
        Rules.unique(pairs, Pair::id);
    }

    @Override
    public QuestionType type() {
        return QuestionType.MATCHING;
    }

    @Override
    public boolean check(Answer answer) {
        return answer instanceof Answer.Pairs given && given.matches().size() == pairs.size()
                && pairs.stream().allMatch(p -> p.id().equals(given.matches().get(p.id())));
    }
}

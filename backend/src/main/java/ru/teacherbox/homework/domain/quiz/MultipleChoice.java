package ru.teacherbox.homework.domain.quiz;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Right only when exactly the correct options are chosen. */
public record MultipleChoice(UUID id, String text, int points, @Nullable String explanation, List<Option> options,
        Set<UUID> correct) implements Question {

    public MultipleChoice {
        text = Rules.text(text, MAX_TEXT, "homework.quiz-text-invalid");
        points = Rules.points(points);
        explanation = Rules.explanation(explanation);
        options = List.copyOf(options);
        correct = Set.copyOf(correct);
        Rules.count(options.size());
        Rules.unique(options, Option::id);
        if (correct.isEmpty() || !options.stream().map(Option::id).collect(Collectors.toSet()).containsAll(correct)) {
            throw new BusinessRuleException("homework.quiz-no-correct", "Correct options must be among the options");
        }
    }

    @Override
    public QuestionType type() {
        return QuestionType.MULTIPLE_CHOICE;
    }

    @Override
    public boolean check(Answer answer) {
        return answer instanceof Answer.Choice choice && choice.ids().equals(correct);
    }
}

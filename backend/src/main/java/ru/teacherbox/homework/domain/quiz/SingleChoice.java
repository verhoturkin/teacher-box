package ru.teacherbox.homework.domain.quiz;

import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

public record SingleChoice(UUID id, String text, int points, @Nullable String explanation, List<Option> options,
        UUID correct) implements Question {

    public SingleChoice {
        text = Rules.text(text, MAX_TEXT, "homework.quiz-text-invalid");
        points = Rules.points(points);
        explanation = Rules.explanation(explanation);
        options = List.copyOf(options);
        Rules.count(options.size());
        Rules.unique(options, Option::id);
        if (options.stream().noneMatch(o -> o.id().equals(correct))) {
            throw new BusinessRuleException("homework.quiz-no-correct", "The correct option is not among the options");
        }
    }

    @Override
    public QuestionType type() {
        return QuestionType.SINGLE_CHOICE;
    }

    @Override
    public boolean check(Answer answer) {
        return answer instanceof Answer.Choice choice && choice.ids().size() == 1 && choice.ids().contains(correct);
    }
}

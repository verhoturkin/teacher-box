package ru.teacherbox.homework.domain.quiz;

import java.util.List;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Rules of the question list of one assignment. */
public final class Quiz {

    public static final int MAX_QUESTIONS = 50;

    private Quiz() {
    }

    public static void requireValid(List<Question> questions) {
        if (questions.size() > MAX_QUESTIONS) {
            throw new BusinessRuleException("homework.quiz-too-many-questions", "At most 50 questions");
        }
        Rules.unique(questions, Question::id);
    }

    public static int maxPoints(List<Question> questions) {
        return questions.stream().mapToInt(Question::points).sum();
    }
}

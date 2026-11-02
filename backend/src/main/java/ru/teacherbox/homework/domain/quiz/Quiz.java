package ru.teacherbox.homework.domain.quiz;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Rules of the question list of one assignment. */
public final class Quiz {

    public static final int MAX_QUESTIONS = 50;

    private Quiz() {
    }

    /** What a draft assignment needs too: a stored list fits the limits, its questions may be incomplete. */
    public static void requireValid(List<QuestionDraft> questions) {
        if (questions.size() > MAX_QUESTIONS) {
            throw new BusinessRuleException("homework.quiz-too-many-questions", "At most 50 questions");
        }
        Rules.unique(questions, QuestionDraft::id);
    }

    /** One broken question: its number from 1 and the code of the first rule it breaks. */
    public record Problem(int number, String code) {
    }

    /**
     * The questions by the rules of their types, for an assignment that is given out (ADR-0054).
     *
     * @throws BusinessRuleException {@code homework.quiz-incomplete} with {@code questions} — every broken question
     */
    public static List<Question> requireComplete(List<QuestionDraft> drafts) {
        requireValid(drafts);
        List<Question> questions = new ArrayList<>();
        List<Problem> problems = new ArrayList<>();
        for (int i = 0; i < drafts.size(); i++) {
            try {
                questions.add(drafts.get(i).toQuestion());
            } catch (BusinessRuleException e) {
                problems.add(new Problem(i + 1, e.code()));
            }
        }
        if (!problems.isEmpty()) {
            throw new BusinessRuleException("homework.quiz-incomplete", "Some questions are not finished",
                    Map.of("questions", problems));
        }
        return questions;
    }

    public static int maxPoints(List<Question> questions) {
        return questions.stream().mapToInt(Question::points).sum();
    }
}

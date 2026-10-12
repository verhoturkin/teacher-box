package ru.teacherbox.homework.domain;

import java.util.List;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * What the page of an interactive assignment reported when the student marked it done (ADR-0040). The page runs in
 * the student's browser, so the values are shown to the teacher, never taken as a grade.
 */
public record InteractiveResult(@Nullable Integer score, @Nullable Integer maxScore, List<Answer> answers) {

    public static final int MAX_SCORE = 10_000;
    public static final int MAX_ANSWERS = 100;
    public static final int MAX_QUESTION = 500;
    public static final int MAX_ANSWER = 2_000;

    /** @param correct as the page decided; {@code null} — the page does not check this question */
    public record Answer(String question, @Nullable String answer, @Nullable Boolean correct) {

        public Answer {
            if (question.isBlank() || question.length() > MAX_QUESTION
                    || answer != null && answer.length() > MAX_ANSWER) {
                throw invalid();
            }
        }
    }

    public InteractiveResult {
        answers = List.copyOf(answers);
        boolean scoreInvalid = score != null && (score < 0 || maxScore == null || score > maxScore);
        boolean maxInvalid = maxScore != null && (maxScore < 1 || maxScore > MAX_SCORE);
        if (scoreInvalid || maxInvalid || answers.size() > MAX_ANSWERS) {
            throw invalid();
        }
    }

    private static BusinessRuleException invalid() {
        return new BusinessRuleException("submission.result-invalid", "The result of the page is not valid");
    }
}

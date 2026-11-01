package ru.teacherbox.homework.application;

import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;
import ru.teacherbox.homework.application.HomeworkViews.QuestionView;
import ru.teacherbox.homework.domain.quiz.QuestionDraft;
import ru.teacherbox.homework.domain.quiz.Quiz;
import ru.teacherbox.homework.persistence.QuestionRepository;
import ru.teacherbox.homework.persistence.QuizAttemptRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Questions of assignments (ADR-0052): saved with the assignment, the whole list at once. */
@Component
class AssignmentQuiz {

    private final QuestionRepository questions;
    private final QuizAttemptRepository attempts;

    AssignmentQuiz(QuestionRepository questions, QuizAttemptRepository attempts) {
        this.questions = questions;
        this.attempts = attempts;
    }

    /**
     * Puts these questions in place of the assignment's ones; a draft keeps incomplete ones (ADR-0054).
     *
     * @param given the assignment is given out (or is being given): every question must be complete
     * @throws BusinessRuleException {@code homework.quiz-*} for an invalid list, {@code homework.quiz-incomplete}
     *                               for broken questions of a given assignment, {@code homework.quiz-started} when
     *                               the list changes after a student started an attempt
     */
    void replace(UUID assignmentId, List<QuestionDraft> replacement, boolean given) {
        if (given) {
            Quiz.requireComplete(replacement);
        } else {
            Quiz.requireValid(replacement);
        }
        if (replacement.equals(questions.findDrafts(assignmentId))) {
            return;
        }
        if (attempts.existsForAssignment(assignmentId)) {
            throw new BusinessRuleException("homework.quiz-started",
                    "A student has already started the quiz: the questions can no longer be changed");
        }
        questions.replace(assignmentId, replacement);
    }

    /**
     * Before the assignment is given out.
     *
     * @throws BusinessRuleException {@code homework.quiz-incomplete} with the broken questions
     */
    void requireComplete(UUID assignmentId) {
        Quiz.requireComplete(questions.findDrafts(assignmentId));
    }

    /** The same questions with new ids in another assignment. */
    void copy(UUID fromAssignmentId, UUID toAssignmentId) {
        questions.replace(toAssignmentId, questions.findDrafts(fromAssignmentId).stream()
                .map(q -> q.withId(Ids.newId())).toList());
    }

    /** As the teacher sees them: with the key, incomplete ones of a draft too. */
    List<QuestionView> of(UUID assignmentId) {
        return questions.findDrafts(assignmentId).stream().map(QuestionView::of).toList();
    }

    void deleteAttempts(UUID assignmentId) {
        attempts.deleteByAssignment(assignmentId);
    }
}

package ru.teacherbox.homework.application;

import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;
import ru.teacherbox.homework.application.HomeworkViews.QuestionView;
import ru.teacherbox.homework.domain.quiz.Matching;
import ru.teacherbox.homework.domain.quiz.MultipleChoice;
import ru.teacherbox.homework.domain.quiz.Numeric;
import ru.teacherbox.homework.domain.quiz.Ordering;
import ru.teacherbox.homework.domain.quiz.Question;
import ru.teacherbox.homework.domain.quiz.Quiz;
import ru.teacherbox.homework.domain.quiz.ShortText;
import ru.teacherbox.homework.domain.quiz.SingleChoice;
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
     * Puts these questions in place of the assignment's ones.
     *
     * @throws BusinessRuleException {@code homework.quiz-*} for an invalid list, {@code homework.quiz-started} when
     *                               the list changes after a student started an attempt
     */
    void replace(UUID assignmentId, List<Question> replacement) {
        Quiz.requireValid(replacement);
        if (replacement.equals(questions.findByAssignment(assignmentId))) {
            return;
        }
        if (attempts.existsForAssignment(assignmentId)) {
            throw new BusinessRuleException("homework.quiz-started",
                    "A student has already started the quiz: the questions can no longer be changed");
        }
        questions.replace(assignmentId, replacement);
    }

    /** The same questions with new ids in another assignment. */
    void copy(UUID fromAssignmentId, UUID toAssignmentId) {
        questions.replace(toAssignmentId, questions.findByAssignment(fromAssignmentId).stream()
                .map(AssignmentQuiz::withNewId).toList());
    }

    /** As the teacher sees them: with the key. */
    List<QuestionView> of(UUID assignmentId) {
        return questions.findByAssignment(assignmentId).stream().map(QuestionView::of).toList();
    }

    void deleteAttempts(UUID assignmentId) {
        attempts.deleteByAssignment(assignmentId);
    }

    private static Question withNewId(Question q) {
        UUID id = Ids.newId();
        return switch (q) {
            case SingleChoice s -> new SingleChoice(id, s.text(), s.points(), s.explanation(), s.options(), s.correct());
            case MultipleChoice m ->
                new MultipleChoice(id, m.text(), m.points(), m.explanation(), m.options(), m.correct());
            case ShortText t -> new ShortText(id, t.text(), t.points(), t.explanation(), t.accepted());
            case Numeric n -> new Numeric(id, n.text(), n.points(), n.explanation(), n.value(), n.tolerance());
            case Matching m -> new Matching(id, m.text(), m.points(), m.explanation(), m.pairs());
            case Ordering o -> new Ordering(id, o.text(), o.points(), o.explanation(), o.items());
        };
    }
}

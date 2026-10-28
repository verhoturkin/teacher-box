package ru.teacherbox.homework.application;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.homework.application.HomeworkViews.QuestionView;
import ru.teacherbox.homework.application.QuizViews.AnswerInput;
import ru.teacherbox.homework.application.QuizViews.AttemptView;
import ru.teacherbox.homework.application.QuizViews.Item;
import ru.teacherbox.homework.application.QuizViews.OpenAttempt;
import ru.teacherbox.homework.application.QuizViews.QuestionResult;
import ru.teacherbox.homework.application.QuizViews.QuizQuestion;
import ru.teacherbox.homework.application.QuizViews.QuizView;
import ru.teacherbox.homework.domain.Assignment;
import ru.teacherbox.homework.domain.HomeworkTask;
import ru.teacherbox.homework.domain.quiz.Answer;
import ru.teacherbox.homework.domain.quiz.Matching;
import ru.teacherbox.homework.domain.quiz.MultipleChoice;
import ru.teacherbox.homework.domain.quiz.Option;
import ru.teacherbox.homework.domain.quiz.Ordering;
import ru.teacherbox.homework.domain.quiz.Question;
import ru.teacherbox.homework.domain.quiz.Quiz;
import ru.teacherbox.homework.domain.quiz.QuizAnswer;
import ru.teacherbox.homework.domain.quiz.QuizAttempt;
import ru.teacherbox.homework.domain.quiz.SingleChoice;
import ru.teacherbox.homework.persistence.AssignmentRepository;
import ru.teacherbox.homework.persistence.QuestionRepository;
import ru.teacherbox.homework.persistence.QuizAttemptRepository;
import ru.teacherbox.homework.persistence.TaskRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;

/**
 * Quiz attempts of a student (ADR-0052). The key leaves this class only in {@link QuizView#results()}, once the
 * assignment's reveal rule allows it. Another student's task, attempt or question is reported as not found.
 */
@Service
public class QuizService {

    private final TaskRepository tasks;
    private final AssignmentRepository assignments;
    private final QuestionRepository questions;
    private final QuizAttemptRepository attempts;
    private final Clock clock;

    public QuizService(TaskRepository tasks, AssignmentRepository assignments, QuestionRepository questions,
            QuizAttemptRepository attempts, Clock clock) {
        this.tasks = tasks;
        this.assignments = assignments;
        this.questions = questions;
        this.attempts = attempts;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public QuizView quiz(UUID studentId, UUID taskId) {
        HomeworkTask task = ownTask(studentId, taskId);
        return view(task, assignment(task), quizQuestions(task));
    }

    /** Starts an attempt; one already in progress is returned instead of a second one. */
    @Transactional
    public QuizView start(UUID studentId, UUID taskId) {
        HomeworkTask task = ownTask(studentId, taskId);
        Assignment assignment = assignment(task);
        List<Question> list = quizQuestions(task);
        requireOpen(task);
        List<QuizAttempt> all = attempts.findByTask(taskId);
        if (all.stream().noneMatch(a -> a.submittedAt() == null)) {
            Integer allowed = assignment.quizAttempts();
            if (allowed != null && all.size() >= allowed) {
                throw new BusinessRuleException("homework.quiz-no-attempts-left", "No attempts left");
            }
            attempts.insert(new QuizAttempt(Ids.newId(), taskId, clock.instant(), null, null, null));
        }
        return view(task, assignment, list);
    }

    /** Autosave: the answer replaces the previous one; it is checked now but the verdict stays hidden. */
    @Transactional
    public void saveAnswer(UUID studentId, UUID taskId, UUID attemptId, UUID questionId, AnswerInput input) {
        HomeworkTask task = ownTask(studentId, taskId);
        List<Question> list = quizQuestions(task);
        QuizAttempt attempt = openAttempt(task, attemptId);
        Question question = list.stream().filter(q -> q.id().equals(questionId)).findFirst()
                .orElseThrow(() -> new NotFoundException("homework.quiz-question-not-found", "Question not found"));
        Answer answer = input.toAnswer(question);
        boolean correct = question.check(answer);
        attempts.saveAnswer(new QuizAnswer(attempt.id(), questionId, answer, correct, correct ? question.points() : 0,
                false));
    }

    @Transactional
    public QuizView submit(UUID studentId, UUID taskId, UUID attemptId) {
        HomeworkTask task = ownTask(studentId, taskId);
        Assignment assignment = assignment(task);
        List<Question> list = quizQuestions(task);
        close(openAttempt(task, attemptId), list, clock.instant());
        return view(task, assignment, list);
    }

    /**
     * «Сдать» of the task: submits the attempt in progress, if any.
     *
     * @return whether the student has a submitted attempt, i.e. the quiz is done
     */
    @Transactional
    public boolean handIn(HomeworkTask task) {
        List<Question> list = questions.findByAssignment(task.assignmentId());
        if (list.isEmpty()) {
            return false;
        }
        List<QuizAttempt> all = attempts.findByTask(task.id());
        for (QuizAttempt attempt : all) {
            if (attempt.submittedAt() == null) {
                close(attempt, list, clock.instant());
            }
        }
        return !all.isEmpty();
    }

    private void close(QuizAttempt attempt, List<Question> list, Instant now) {
        int score = attempts.findAnswers(attempt.id()).stream().mapToInt(QuizAnswer::points).sum();
        attempts.submit(attempt.id(), now, score, Quiz.maxPoints(list));
    }

    private QuizView view(HomeworkTask task, Assignment assignment, List<Question> list) {
        List<QuizAttempt> all = attempts.findByTask(task.id());
        QuizAttempt open = all.stream().filter(a -> a.submittedAt() == null).findFirst().orElse(null);
        List<AttemptView> done = all.stream().filter(a -> a.submittedAt() != null).map(QuizService::attemptView)
                .toList();
        AttemptView best = done.stream().max(Comparator.comparingInt(a -> Objects.requireNonNull(a.scorePoints())))
                .orElse(null);
        Integer allowed = assignment.quizAttempts();
        Integer left = allowed == null ? null : Math.max(0, allowed - all.size());
        UUID seed = open == null ? task.id() : open.id();
        List<QuizQuestion> shown = list.stream().map(q -> shown(q, seed)).toList();
        OpenAttempt openView = open == null ? null : new OpenAttempt(open.id(), open.startedAt(),
                attempts.findAnswers(open.id()).stream()
                        .collect(Collectors.toMap(QuizAnswer::questionId, a -> AnswerInput.of(a.answer()))));
        return new QuizView(shown, Quiz.maxPoints(list), assignment.quizReveal(), allowed, all.size(), left,
                task.status().isOpen() && open == null && (left == null || left > 0), openView, done, best,
                best == null || !revealed(assignment) ? null : results(list, best.id()));
    }

    private boolean revealed(Assignment assignment) {
        return switch (assignment.quizReveal()) {
            case AFTER_SUBMIT -> true;
            case AFTER_DUE -> assignment.dueAt() != null && clock.instant().isAfter(assignment.dueAt());
            case NEVER -> false;
        };
    }

    private List<QuestionResult> results(List<Question> list, UUID attemptId) {
        Map<UUID, QuizAnswer> given = attempts.findAnswers(attemptId).stream()
                .collect(Collectors.toMap(QuizAnswer::questionId, Function.identity()));
        List<QuestionResult> results = new ArrayList<>();
        for (Question q : list) {
            QuizAnswer a = given.get(q.id());
            results.add(new QuestionResult(QuestionView.of(q), a == null ? null : AnswerInput.of(a.answer()),
                    a != null && a.correct(), a == null ? 0 : a.points()));
        }
        return results;
    }

    /** The question without the key, shuffled by the stable ids so that a reload shows the same order. */
    private static QuizQuestion shown(Question q, UUID seed) {
        List<Item> options = List.of();
        List<Item> left = List.of();
        List<Item> right = List.of();
        switch (q) {
            case SingleChoice s -> options = items(s.options(), seed);
            case MultipleChoice m -> options = items(m.options(), seed);
            case Ordering o -> options = items(o.items(), seed);
            case Matching m -> {
                left = m.pairs().stream().map(p -> new Item(p.id(), p.left())).toList();
                right = shuffle(m.pairs().stream().map(p -> new Item(p.id(), p.right())).toList(), seed);
            }
            default -> { }
        }
        return new QuizQuestion(q.id(), q.type(), q.text(), q.points(), options, left, right);
    }

    private static List<Item> items(List<Option> options, UUID seed) {
        return shuffle(options.stream().map(o -> new Item(o.id(), o.text())).toList(), seed);
    }

    private static List<Item> shuffle(List<Item> items, UUID seed) {
        return items.stream().sorted(Comparator.comparingInt((Item i) -> Objects.hash(seed, i.id()))
                .thenComparing(Item::id)).toList();
    }

    private static AttemptView attemptView(QuizAttempt a) {
        return new AttemptView(a.id(), a.startedAt(), a.submittedAt(), a.scorePoints(), a.maxPoints());
    }

    private QuizAttempt openAttempt(HomeworkTask task, UUID attemptId) {
        requireOpen(task);
        QuizAttempt attempt = attempts.findById(attemptId).filter(a -> a.taskId().equals(task.id()))
                .orElseThrow(() -> new NotFoundException("homework.quiz-attempt-not-found", "Attempt not found"));
        if (attempt.submittedAt() != null) {
            throw new BusinessRuleException("homework.quiz-attempt-closed", "The attempt has been submitted");
        }
        return attempt;
    }

    /** Attempts are closed once the task is submitted or accepted. */
    private static void requireOpen(HomeworkTask task) {
        if (!task.status().isOpen()) {
            throw new BusinessRuleException("homework.quiz-closed", "The task has already been handed in");
        }
    }

    private List<Question> quizQuestions(HomeworkTask task) {
        List<Question> list = questions.findByAssignment(task.assignmentId());
        if (list.isEmpty()) {
            throw new NotFoundException("homework.quiz-not-found", "This assignment has no quiz");
        }
        return list;
    }

    private Assignment assignment(HomeworkTask task) {
        return assignments.findById(task.assignmentId())
                .orElseThrow(() -> new IllegalStateException("Task " + task.id() + " has no assignment"));
    }

    private HomeworkTask ownTask(UUID studentId, UUID taskId) {
        return tasks.findById(taskId).filter(t -> t.studentId().equals(studentId))
                .orElseThrow(() -> new NotFoundException("task.not-found", "Task not found"));
    }
}

package ru.teacherbox.homework.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.homework.api.HomeworkReviewed;
import ru.teacherbox.homework.application.HomeworkViews.ReviewQueueItem;
import ru.teacherbox.homework.application.HomeworkViews.TaskDetails;
import ru.teacherbox.homework.application.QuizViews.QuizStats;
import ru.teacherbox.homework.domain.Assignment;
import ru.teacherbox.homework.domain.HomeworkTask;
import ru.teacherbox.homework.persistence.AssignmentRepository;
import ru.teacherbox.homework.persistence.TaskRepository;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.error.NotFoundException;

/** The teacher reviews submitted tasks. */
@Service
public class ReviewService {

    public enum Decision {
        ACCEPT,
        RETURN
    }

    private final TaskRepository tasks;
    private final AssignmentRepository assignments;
    private final TaskDetailsAssembler assembler;
    private final UserDirectory directory;
    private final QuizService quiz;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public ReviewService(TaskRepository tasks, AssignmentRepository assignments, TaskDetailsAssembler assembler,
            UserDirectory directory, QuizService quiz, ApplicationEventPublisher events, Clock clock) {
        this.quiz = quiz;
        this.tasks = tasks;
        this.assignments = assignments;
        this.assembler = assembler;
        this.directory = directory;
        this.events = events;
        this.clock = clock;
    }

    /** Submitted tasks, oldest first. */
    @Transactional(readOnly = true)
    public List<ReviewQueueItem> queue() {
        List<HomeworkTask> submitted = tasks.findSubmitted();
        Map<UUID, Assignment> byId = assignments
                .findByIds(submitted.stream().map(HomeworkTask::assignmentId).distinct().toList()).stream()
                .collect(Collectors.toMap(Assignment::id, Function.identity()));
        Map<UUID, StudentSummary> students = directory
                .findStudents(submitted.stream().map(HomeworkTask::studentId).toList()).stream()
                .collect(Collectors.toMap(StudentSummary::id, Function.identity(), (a, b) -> a));
        return submitted.stream()
                .filter(task -> byId.containsKey(task.assignmentId()))
                .map(task -> {
                    Assignment assignment = byId.get(task.assignmentId());
                    StudentSummary student = students.get(task.studentId());
                    return new ReviewQueueItem(task.id(), assignment.id(), assignment.title(), task.studentId(),
                            student == null ? TaskDetailsAssembler.unknownStudent() : student.displayName(),
                            student == null ? null : student.avatar(), task.submittedAt(), assignment.dueAt());
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskDetails task(UUID taskId) {
        return assembler.details(load(taskId), true);
    }

    /** Marks one answer of the task's best attempt right or wrong and recomputes the score. */
    @Transactional
    public TaskDetails overrideAnswer(UUID taskId, UUID questionId, boolean correct) {
        HomeworkTask task = load(taskId);
        quiz.override(task, questionId, correct);
        return assembler.details(task, true);
    }

    /** Per-question results of the assignment's quiz. */
    @Transactional(readOnly = true)
    public QuizStats quizStats(UUID assignmentId) {
        assignments.findById(assignmentId)
                .orElseThrow(() -> new NotFoundException("assignment.not-found", "Assignment not found"));
        return quiz.stats(assignmentId);
    }

    @Transactional
    public TaskDetails review(UUID taskId, Decision decision, @Nullable String grade, @Nullable String comment) {
        HomeworkTask task = load(taskId);
        Instant now = clock.instant();
        switch (decision) {
            case ACCEPT -> task.accept(grade, comment, now);
            case RETURN -> task.returnForRevision(comment, now);
        }
        tasks.update(task);
        String title = assignments.findById(task.assignmentId()).map(Assignment::title).orElse("");
        events.publishEvent(new HomeworkReviewed(task.id(), task.assignmentId(), task.studentId(), title,
                decision == Decision.ACCEPT, task.grade(), now));
        return assembler.details(task, true);
    }

    private HomeworkTask load(UUID taskId) {
        return tasks.findById(taskId).orElseThrow(() -> new NotFoundException("task.not-found", "Task not found"));
    }
}

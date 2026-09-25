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
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public ReviewService(TaskRepository tasks, AssignmentRepository assignments, TaskDetailsAssembler assembler,
            UserDirectory directory, ApplicationEventPublisher events, Clock clock) {
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
        Map<UUID, String> names = directory.findStudents(submitted.stream().map(HomeworkTask::studentId).toList())
                .stream()
                .collect(Collectors.toMap(StudentSummary::id, StudentSummary::displayName, (a, b) -> a));
        return submitted.stream()
                .filter(task -> byId.containsKey(task.assignmentId()))
                .map(task -> {
                    Assignment assignment = byId.get(task.assignmentId());
                    return new ReviewQueueItem(task.id(), assignment.id(), assignment.title(), task.studentId(),
                            names.getOrDefault(task.studentId(), TaskDetailsAssembler.UNKNOWN_STUDENT),
                            task.submittedAt(), assignment.dueAt());
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskDetails task(UUID taskId) {
        return assembler.details(load(taskId));
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
        return assembler.details(task);
    }

    private HomeworkTask load(UUID taskId) {
        return tasks.findById(taskId).orElseThrow(() -> new NotFoundException("task.not-found", "Task not found"));
    }
}

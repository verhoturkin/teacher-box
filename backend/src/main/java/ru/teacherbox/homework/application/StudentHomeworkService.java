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
import ru.teacherbox.homework.api.HomeworkSubmitted;
import ru.teacherbox.homework.application.HomeworkViews.MyTask;
import ru.teacherbox.homework.application.HomeworkViews.TaskDetails;
import ru.teacherbox.homework.domain.Assignment;
import ru.teacherbox.homework.domain.Attachment;
import ru.teacherbox.homework.domain.AttachmentOwner;
import ru.teacherbox.homework.domain.HomeworkTask;
import ru.teacherbox.homework.domain.Submission;
import ru.teacherbox.homework.persistence.AssignmentRepository;
import ru.teacherbox.homework.persistence.SubmissionRepository;
import ru.teacherbox.homework.persistence.TaskRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.NotFoundException;

/**
 * Homework in the student's personal area. Every operation checks that the task belongs to the
 * student; foreign tasks and files are reported as not found.
 */
@Service
public class StudentHomeworkService {

    private final TaskRepository tasks;
    private final AssignmentRepository assignments;
    private final SubmissionRepository submissions;
    private final AttachmentService attachments;
    private final TaskDetailsAssembler assembler;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public StudentHomeworkService(TaskRepository tasks, AssignmentRepository assignments,
            SubmissionRepository submissions, AttachmentService attachments, TaskDetailsAssembler assembler,
            ApplicationEventPublisher events, Clock clock) {
        this.tasks = tasks;
        this.assignments = assignments;
        this.submissions = submissions;
        this.attachments = attachments;
        this.assembler = assembler;
        this.events = events;
        this.clock = clock;
    }

    /** The student's tasks, newest first. */
    @Transactional(readOnly = true)
    public List<MyTask> tasks(UUID studentId) {
        Instant now = clock.instant();
        List<HomeworkTask> own = tasks.findByStudent(studentId);
        Map<UUID, Assignment> byId = assignments.findByIds(own.stream().map(HomeworkTask::assignmentId).toList())
                .stream()
                .collect(Collectors.toMap(Assignment::id, Function.identity()));
        return own.stream()
                .filter(task -> byId.containsKey(task.assignmentId()))
                .map(task -> {
                    Assignment assignment = byId.get(task.assignmentId());
                    return new MyTask(task.id(), assignment.id(), assignment.title(), assignment.dueAt(),
                            task.status(), task.grade(), task.isOverdue(assignment.dueAt(), now), task.assignedAt(),
                            task.reviewedAt());
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskDetails task(UUID studentId, UUID taskId) {
        return assembler.details(ownTask(studentId, taskId));
    }

    @Transactional
    public TaskDetails submit(UUID studentId, UUID taskId, @Nullable String text, List<UploadedFile> files) {
        HomeworkTask task = ownTask(studentId, taskId);
        Instant now = clock.instant();
        task.submit(now);
        Submission submission = Submission.create(Ids.newId(), task.id(), text, !files.isEmpty(), now);
        tasks.update(task);
        submissions.insert(submission);
        attachments.store(AttachmentOwner.SUBMISSION, submission.id(), files, now);
        String title = assignments.findById(task.assignmentId()).map(Assignment::title).orElse("");
        events.publishEvent(new HomeworkSubmitted(task.id(), task.assignmentId(), studentId, title, now));
        return assembler.details(task);
    }

    /** Files of the student's own assignments and submissions only. */
    @Transactional(readOnly = true)
    public AttachmentService.FileDownload download(UUID studentId, UUID attachmentId) {
        Attachment attachment = attachments.load(attachmentId);
        boolean allowed = switch (attachment.ownerType()) {
            case ASSIGNMENT -> tasks.findByStudent(studentId).stream()
                    .anyMatch(task -> task.assignmentId().equals(attachment.ownerId()));
            case SUBMISSION -> tasks.findByStudent(studentId).stream()
                    .flatMap(task -> submissions.findByTask(task.id()).stream())
                    .anyMatch(submission -> submission.id().equals(attachment.ownerId()));
        };
        if (!allowed) {
            throw new NotFoundException("file.not-found", "File not found");
        }
        return attachments.download(attachment);
    }

    private HomeworkTask ownTask(UUID studentId, UUID taskId) {
        return tasks.findById(taskId)
                .filter(task -> task.studentId().equals(studentId))
                .orElseThrow(() -> new NotFoundException("task.not-found", "Task not found"));
    }
}

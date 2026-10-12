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
import ru.teacherbox.homework.domain.AssignmentKind;
import ru.teacherbox.homework.domain.Attachment;
import ru.teacherbox.homework.domain.AttachmentOwner;
import ru.teacherbox.homework.domain.HomeworkTask;
import ru.teacherbox.homework.domain.InteractiveResult;
import ru.teacherbox.homework.domain.Submission;
import ru.teacherbox.homework.persistence.AssignmentRepository;
import ru.teacherbox.homework.persistence.SubmissionRepository;
import ru.teacherbox.homework.persistence.TaskRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.textbooks.api.TextbookContent;

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
    private final TextbookBindings textbooks;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public StudentHomeworkService(TaskRepository tasks, AssignmentRepository assignments,
            SubmissionRepository submissions, AttachmentService attachments, TaskDetailsAssembler assembler,
            TextbookBindings textbooks, ApplicationEventPublisher events, Clock clock) {
        this.tasks = tasks;
        this.assignments = assignments;
        this.submissions = submissions;
        this.attachments = attachments;
        this.assembler = assembler;
        this.textbooks = textbooks;
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

    /** The pages of a textbook bound to the student's task (ADR-0033); anything else is not found. */
    @Transactional(readOnly = true)
    public TextbookContent textbook(UUID studentId, UUID taskId, UUID textbookId) {
        return textbooks.content(ownTask(studentId, taskId).assignmentId(), textbookId);
    }

    /** Hands in written homework: a text, files or both. */
    @Transactional
    public TaskDetails submit(UUID studentId, UUID taskId, @Nullable String text, List<UploadedFile> files) {
        HomeworkTask task = ownTask(studentId, taskId);
        Assignment assignment = assignmentOf(task);
        if (assignment.kind() != AssignmentKind.WRITTEN) {
            throw kindMismatch();
        }
        Instant now = clock.instant();
        Submission submission = Submission.create(Ids.newId(), task.id(), text, !files.isEmpty(), now);
        handIn(task, assignment, submission);
        attachments.store(AttachmentOwner.SUBMISSION, submission.id(), files, now);
        return assembler.details(task);
    }

    /**
     * Marks homework on a board or interactive homework done.
     *
     * @param result what the interactive page reported; kept for interactive homework only
     */
    @Transactional
    public TaskDetails markDone(UUID studentId, UUID taskId, @Nullable InteractiveResult result) {
        HomeworkTask task = ownTask(studentId, taskId);
        Assignment assignment = assignmentOf(task);
        if (assignment.kind() == AssignmentKind.WRITTEN) {
            throw kindMismatch();
        }
        handIn(task, assignment, Submission.done(Ids.newId(), task.id(),
                assignment.kind() == AssignmentKind.INTERACTIVE ? result : null, clock.instant()));
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

    private void handIn(HomeworkTask task, Assignment assignment, Submission submission) {
        task.submit(submission.submittedAt());
        tasks.update(task);
        submissions.insert(submission);
        events.publishEvent(new HomeworkSubmitted(task.id(), task.assignmentId(), task.studentId(),
                assignment.title(), submission.submittedAt()));
    }

    private Assignment assignmentOf(HomeworkTask task) {
        return assignments.findById(task.assignmentId())
                .orElseThrow(() -> new NotFoundException("task.not-found", "Task not found"));
    }

    private static BusinessRuleException kindMismatch() {
        return new BusinessRuleException("submission.kind-mismatch",
                "Written homework is answered with a text or files, other kinds are marked done");
    }

    private HomeworkTask ownTask(UUID studentId, UUID taskId) {
        return tasks.findById(taskId)
                .filter(task -> task.studentId().equals(studentId))
                .orElseThrow(() -> new NotFoundException("task.not-found", "Task not found"));
    }
}

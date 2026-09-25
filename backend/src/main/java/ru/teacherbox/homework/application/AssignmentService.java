package ru.teacherbox.homework.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.homework.api.HomeworkAssigned;
import ru.teacherbox.homework.application.HomeworkViews.AssignmentDetails;
import ru.teacherbox.homework.application.HomeworkViews.AssignmentSummary;
import ru.teacherbox.homework.application.HomeworkViews.AttachmentView;
import ru.teacherbox.homework.application.HomeworkViews.TaskSummary;
import ru.teacherbox.homework.domain.Assignment;
import ru.teacherbox.homework.domain.Attachment;
import ru.teacherbox.homework.domain.AttachmentOwner;
import ru.teacherbox.homework.domain.HomeworkTask;
import ru.teacherbox.homework.domain.TaskStatus;
import ru.teacherbox.homework.persistence.AssignmentRepository;
import ru.teacherbox.homework.persistence.TaskRepository;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;

/** The teacher's assignments: creating, editing, giving them to students, materials. */
@Service
public class AssignmentService {

    private final AssignmentRepository assignments;
    private final TaskRepository tasks;
    private final AttachmentService attachments;
    private final UserDirectory directory;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public AssignmentService(AssignmentRepository assignments, TaskRepository tasks, AttachmentService attachments,
            UserDirectory directory, ApplicationEventPublisher events, Clock clock) {
        this.assignments = assignments;
        this.tasks = tasks;
        this.attachments = attachments;
        this.directory = directory;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public AssignmentDetails create(String title, @Nullable String description, @Nullable Instant dueAt,
            Collection<UUID> studentIds) {
        Instant now = clock.instant();
        Assignment assignment = Assignment.create(Ids.newId(), title, description, dueAt, now);
        assignments.insert(assignment);
        assignTo(assignment, studentIds, now);
        return details(assignment);
    }

    /**
     * @throws OptimisticLockingFailureException if the assignment was changed after {@code expectedVersion}
     */
    @Transactional
    public AssignmentDetails update(UUID assignmentId, String title, @Nullable String description,
            @Nullable Instant dueAt, long expectedVersion) {
        Assignment assignment = load(assignmentId);
        if (assignment.version() != expectedVersion) {
            throw new OptimisticLockingFailureException("Assignment " + assignmentId + " was modified");
        }
        assignment.update(title, description, dueAt, clock.instant());
        assignments.update(assignment);
        return details(assignment);
    }

    /** Gives the assignment to more students; students who already have it are skipped. */
    @Transactional
    public AssignmentDetails assign(UUID assignmentId, Collection<UUID> studentIds) {
        Assignment assignment = load(assignmentId);
        Set<UUID> assigned = tasks.findByAssignment(assignmentId).stream()
                .map(HomeworkTask::studentId)
                .collect(Collectors.toSet());
        assignTo(assignment, studentIds.stream().filter(id -> !assigned.contains(id)).toList(), clock.instant());
        return details(assignment);
    }

    @Transactional(readOnly = true)
    public List<AssignmentSummary> list() {
        Map<UUID, Map<TaskStatus, Integer>> counts = tasks.statusCounts();
        return assignments.findAll().stream().map(assignment -> {
            Map<TaskStatus, Integer> byStatus = counts.getOrDefault(assignment.id(), Map.of());
            int assigned = byStatus.getOrDefault(TaskStatus.ASSIGNED, 0);
            int submitted = byStatus.getOrDefault(TaskStatus.SUBMITTED, 0);
            int returned = byStatus.getOrDefault(TaskStatus.RETURNED, 0);
            int accepted = byStatus.getOrDefault(TaskStatus.ACCEPTED, 0);
            return new AssignmentSummary(assignment.id(), assignment.title(), assignment.dueAt(),
                    assignment.createdAt(), assigned + submitted + returned + accepted, assigned, submitted, returned,
                    accepted);
        }).toList();
    }

    @Transactional(readOnly = true)
    public AssignmentDetails get(UUID assignmentId) {
        return details(load(assignmentId));
    }

    @Transactional
    public List<AttachmentView> addAttachments(UUID assignmentId, List<UploadedFile> files) {
        Assignment assignment = load(assignmentId);
        return attachments.store(AttachmentOwner.ASSIGNMENT, assignment.id(), files, clock.instant()).stream()
                .map(AttachmentView::of)
                .toList();
    }

    @Transactional
    public void removeAttachment(UUID assignmentId, UUID attachmentId) {
        Attachment attachment = attachments.load(attachmentId);
        if (attachment.ownerType() != AttachmentOwner.ASSIGNMENT || !attachment.ownerId().equals(assignmentId)) {
            throw new NotFoundException("file.not-found", "File not found");
        }
        attachments.delete(attachment);
    }

    /** The teacher may download every file. */
    @Transactional(readOnly = true)
    public AttachmentService.FileDownload download(UUID attachmentId) {
        return attachments.download(attachments.load(attachmentId));
    }

    private void assignTo(Assignment assignment, Collection<UUID> studentIds, Instant now) {
        for (UUID studentId : new LinkedHashSet<>(studentIds)) {
            StudentSummary student = directory.findStudent(studentId)
                    .orElseThrow(() -> new NotFoundException("student.not-found", "Student not found"));
            if (!student.isCurrent()) {
                throw new BusinessRuleException("student.deactivated",
                        "Homework cannot be given to a deactivated student: " + student.displayName());
            }
            HomeworkTask task = HomeworkTask.assign(Ids.newId(), assignment.id(), studentId, now);
            tasks.insert(task);
            events.publishEvent(new HomeworkAssigned(task.id(), assignment.id(), studentId, assignment.title(),
                    assignment.dueAt(), now));
        }
    }

    private AssignmentDetails details(Assignment assignment) {
        Instant now = clock.instant();
        List<HomeworkTask> assignmentTasks = tasks.findByAssignment(assignment.id());
        Map<UUID, String> names = directory
                .findStudents(assignmentTasks.stream().map(HomeworkTask::studentId).toList()).stream()
                .collect(Collectors.toMap(StudentSummary::id, StudentSummary::displayName, (a, b) -> a));
        Function<HomeworkTask, TaskSummary> summary = task -> new TaskSummary(task.id(), task.studentId(),
                names.getOrDefault(task.studentId(), TaskDetailsAssembler.UNKNOWN_STUDENT), task.status(),
                task.grade(), task.submittedAt(), task.reviewedAt(), task.isOverdue(assignment.dueAt(), now));
        return new AssignmentDetails(assignment.id(), assignment.title(), assignment.description(),
                assignment.dueAt(), assignment.createdAt(), assignment.version(),
                attachments.of(AttachmentOwner.ASSIGNMENT, assignment.id()).stream().map(AttachmentView::of).toList(),
                assignmentTasks.stream()
                        .map(summary)
                        .sorted(Comparator.comparing(TaskSummary::studentName, String.CASE_INSENSITIVE_ORDER))
                        .toList());
    }

    private Assignment load(UUID assignmentId) {
        return assignments.findById(assignmentId)
                .orElseThrow(() -> new NotFoundException("assignment.not-found", "Assignment not found"));
    }
}

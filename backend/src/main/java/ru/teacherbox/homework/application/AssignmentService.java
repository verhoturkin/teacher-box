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
import ru.teacherbox.homework.application.HomeworkViews.VideoInput;
import ru.teacherbox.homework.domain.Assignment;
import ru.teacherbox.homework.domain.Attachment;
import ru.teacherbox.homework.domain.AttachmentOwner;
import ru.teacherbox.homework.domain.HomeworkTask;
import ru.teacherbox.homework.domain.TaskStatus;
import ru.teacherbox.homework.persistence.AssignmentRepository;
import ru.teacherbox.homework.persistence.SubmissionRepository;
import ru.teacherbox.homework.persistence.TaskRepository;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;

/** The teacher's assignments: creating, editing, giving them to students, materials. */
@Service
public class AssignmentService {

    private static final String COPY_SUFFIX = " (копия)";

    private final AssignmentRepository assignments;
    private final TaskRepository tasks;
    private final SubmissionRepository submissions;
    private final AttachmentService attachments;
    private final TextbookBindings textbooks;
    private final AssignmentVideos videos;
    private final UserDirectory directory;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public AssignmentService(AssignmentRepository assignments, TaskRepository tasks,
            SubmissionRepository submissions, AttachmentService attachments, TextbookBindings textbooks,
            AssignmentVideos videos, UserDirectory directory, ApplicationEventPublisher events, Clock clock) {
        this.assignments = assignments;
        this.tasks = tasks;
        this.submissions = submissions;
        this.attachments = attachments;
        this.textbooks = textbooks;
        this.videos = videos;
        this.directory = directory;
        this.events = events;
        this.clock = clock;
    }

    /** An assignment without videos. */
    @Transactional
    public AssignmentDetails create(String title, @Nullable String description, @Nullable Instant dueAt,
            Collection<UUID> studentIds) {
        return create(title, description, dueAt, List.of(), studentIds);
    }

    /** @param videoInputs the videos of the assignment by link (ADR-0047), at most 5 */
    @Transactional
    public AssignmentDetails create(String title, @Nullable String description, @Nullable Instant dueAt,
            List<VideoInput> videoInputs, Collection<UUID> studentIds) {
        Instant now = clock.instant();
        Assignment assignment = Assignment.create(Ids.newId(), title, description, dueAt, now);
        assignments.insert(assignment);
        videos.replace(assignment.id(), videoInputs);
        assignTo(assignment, studentIds, now);
        return details(assignment);
    }

    /**
     * @param videoInputs the videos in place of the assignment's ones; {@code null} — keep them
     * @throws OptimisticLockingFailureException if the assignment was changed after {@code expectedVersion}
     */
    @Transactional
    public AssignmentDetails update(UUID assignmentId, String title, @Nullable String description,
            @Nullable Instant dueAt, @Nullable List<VideoInput> videoInputs, long expectedVersion) {
        Assignment assignment = load(assignmentId);
        if (assignment.version() != expectedVersion) {
            throw new OptimisticLockingFailureException("Assignment " + assignmentId + " was modified");
        }
        assignment.update(title, description, dueAt, clock.instant());
        assignments.update(assignment);
        if (videoInputs != null) {
            videos.replace(assignment.id(), videoInputs);
        }
        return details(assignment);
    }

    /**
     * A draft «title (копия)»: the text, files (new copies in the storage), textbooks with pages and videos with
     * transcripts; no students, no deadline, no board.
     */
    @Transactional
    public AssignmentDetails copy(UUID assignmentId) {
        Assignment source = load(assignmentId);
        Instant now = clock.instant();
        Assignment copy = source.copy(Ids.newId(), COPY_SUFFIX, now);
        assignments.insert(copy);
        attachments.copyAll(AttachmentOwner.ASSIGNMENT, source.id(), copy.id(), now);
        textbooks.copy(source.id(), copy.id());
        videos.copy(source.id(), copy.id());
        return details(copy);
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
        Map<UUID, List<UUID>> studentsOf = tasks.studentsByAssignment();
        Map<UUID, String> names = directory
                .findStudents(studentsOf.values().stream().flatMap(List::stream).distinct().toList()).stream()
                .collect(Collectors.toMap(StudentSummary::id, StudentSummary::displayName, (a, b) -> a));
        return assignments.findAll().stream().map(assignment -> {
            Map<TaskStatus, Integer> byStatus = counts.getOrDefault(assignment.id(), Map.of());
            int assigned = byStatus.getOrDefault(TaskStatus.ASSIGNED, 0);
            int submitted = byStatus.getOrDefault(TaskStatus.SUBMITTED, 0);
            int returned = byStatus.getOrDefault(TaskStatus.RETURNED, 0);
            int accepted = byStatus.getOrDefault(TaskStatus.ACCEPTED, 0);
            List<String> students = studentsOf.getOrDefault(assignment.id(), List.of()).stream()
                    .map(id -> names.getOrDefault(id, TaskDetailsAssembler.unknownStudent()))
                    .sorted(String.CASE_INSENSITIVE_ORDER)
                    .toList();
            return new AssignmentSummary(assignment.id(), assignment.title(), assignment.dueAt(),
                    assignment.createdAt(), students, assignment.boardId(), assigned + submitted + returned + accepted, assigned, submitted, returned,
                    accepted);
        }).toList();
    }

    /**
     * Deletes the assignment: the files of the assignment and of the answers, the answers, the tasks and the
     * assignment (bound textbooks go with it).
     */
    @Transactional
    public void delete(UUID assignmentId) {
        Assignment assignment = load(assignmentId);
        attachments.deleteAll(AttachmentOwner.SUBMISSION, submissions.idsByAssignment(assignment.id()));
        attachments.deleteAll(AttachmentOwner.ASSIGNMENT, List.of(assignment.id()));
        submissions.deleteByAssignment(assignment.id());
        tasks.deleteByAssignment(assignment.id());
        assignments.delete(assignment.id());
    }

    /** Remembers the board the assignment was put on ({@code null} forgets it): its students get a link to it. */
    @Transactional
    public AssignmentDetails placeOnBoard(UUID assignmentId, @Nullable UUID boardId) {
        Assignment assignment = load(assignmentId);
        assignment.placeOnBoard(boardId);
        assignments.updateBoard(assignment);
        return details(assignment);
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

    /**
     * Binds a textbook to the assignment, or changes its pages (ADR-0033).
     *
     * @param pages {@code 1-3, 7}; blank — the whole textbook
     */
    @Transactional
    public AssignmentDetails bindTextbook(UUID assignmentId, UUID textbookId, @Nullable String pages) {
        Assignment assignment = load(assignmentId);
        textbooks.bind(assignmentId, textbookId, pages);
        return details(assignment);
    }

    @Transactional
    public AssignmentDetails unbindTextbook(UUID assignmentId, UUID textbookId) {
        Assignment assignment = load(assignmentId);
        textbooks.unbind(assignmentId, textbookId);
        return details(assignment);
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
        Map<UUID, StudentSummary> students = directory
                .findStudents(assignmentTasks.stream().map(HomeworkTask::studentId).toList()).stream()
                .collect(Collectors.toMap(StudentSummary::id, Function.identity(), (a, b) -> a));
        Function<HomeworkTask, TaskSummary> summary = task -> {
            StudentSummary student = students.get(task.studentId());
            return new TaskSummary(task.id(), task.studentId(),
                    student == null ? TaskDetailsAssembler.unknownStudent() : student.displayName(),
                    student == null ? null : student.avatar(), task.status(), task.grade(), task.submittedAt(),
                    task.reviewedAt(), task.isOverdue(assignment.dueAt(), now));
        };
        return new AssignmentDetails(assignment.id(), assignment.title(), assignment.description(),
                assignment.dueAt(), assignment.boardId(), assignment.createdAt(), assignment.version(),
                attachments.of(AttachmentOwner.ASSIGNMENT, assignment.id()).stream().map(AttachmentView::of).toList(),
                assignmentTasks.stream()
                        .map(summary)
                        .sorted(Comparator.comparing(TaskSummary::studentName, String.CASE_INSENSITIVE_ORDER))
                        .toList(),
                textbooks.of(assignment.id()),
                videos.of(assignment.id()));
    }

    private Assignment load(UUID assignmentId) {
        return assignments.findById(assignmentId)
                .orElseThrow(() -> new NotFoundException("assignment.not-found", "Assignment not found"));
    }
}

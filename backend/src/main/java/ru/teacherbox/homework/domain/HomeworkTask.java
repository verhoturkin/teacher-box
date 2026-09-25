package ru.teacherbox.homework.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * An assignment given to one student. Transitions:
 * <ul>
 *   <li>submit: ASSIGNED, RETURNED or SUBMITTED (a new attempt before review) → SUBMITTED;</li>
 *   <li>accept: SUBMITTED → ACCEPTED (with an optional grade and comment);</li>
 *   <li>return for revision: SUBMITTED or ACCEPTED (reopening) → RETURNED.</li>
 * </ul>
 */
public final class HomeworkTask {

    public static final int MAX_GRADE = 20;
    public static final int MAX_COMMENT = 5_000;

    private final UUID id;
    private final UUID assignmentId;
    private final UUID studentId;
    private TaskStatus status;
    private @Nullable String grade;
    private @Nullable String teacherComment;
    private final Instant assignedAt;
    private @Nullable Instant submittedAt;
    private @Nullable Instant reviewedAt;
    private @Nullable Instant dueReminderSentAt;
    private long version;

    private HomeworkTask(UUID id, UUID assignmentId, UUID studentId, TaskStatus status, @Nullable String grade,
            @Nullable String teacherComment, Instant assignedAt, @Nullable Instant submittedAt,
            @Nullable Instant reviewedAt, @Nullable Instant dueReminderSentAt, long version) {
        this.id = Objects.requireNonNull(id);
        this.assignmentId = Objects.requireNonNull(assignmentId);
        this.studentId = Objects.requireNonNull(studentId);
        this.status = Objects.requireNonNull(status);
        this.grade = grade;
        this.teacherComment = teacherComment;
        this.assignedAt = Objects.requireNonNull(assignedAt);
        this.submittedAt = submittedAt;
        this.reviewedAt = reviewedAt;
        this.dueReminderSentAt = dueReminderSentAt;
        this.version = version;
    }

    public static HomeworkTask assign(UUID id, UUID assignmentId, UUID studentId, Instant now) {
        return new HomeworkTask(id, assignmentId, studentId, TaskStatus.ASSIGNED, null, null, now, null, null, null,
                0);
    }

    public static HomeworkTask restore(UUID id, UUID assignmentId, UUID studentId, TaskStatus status,
            @Nullable String grade, @Nullable String teacherComment, Instant assignedAt,
            @Nullable Instant submittedAt, @Nullable Instant reviewedAt, @Nullable Instant dueReminderSentAt,
            long version) {
        return new HomeworkTask(id, assignmentId, studentId, status, grade, teacherComment, assignedAt, submittedAt,
                reviewedAt, dueReminderSentAt, version);
    }

    /** The student hands in a (new) answer. */
    public void submit(Instant now) {
        if (status == TaskStatus.ACCEPTED) {
            throw new BusinessRuleException("task.already-accepted", "The task has already been accepted");
        }
        status = TaskStatus.SUBMITTED;
        submittedAt = now;
    }

    public void accept(@Nullable String newGrade, @Nullable String comment, Instant now) {
        if (status != TaskStatus.SUBMITTED) {
            throw new BusinessRuleException("task.not-submitted", "Only a submitted task can be accepted");
        }
        // Validate before changing anything, so that a rejected review leaves the task untouched.
        String validGrade = validGrade(newGrade);
        String validComment = validComment(comment);
        status = TaskStatus.ACCEPTED;
        grade = validGrade;
        teacherComment = validComment;
        reviewedAt = now;
    }

    public void returnForRevision(@Nullable String comment, Instant now) {
        if (status != TaskStatus.SUBMITTED && status != TaskStatus.ACCEPTED) {
            throw new BusinessRuleException("task.not-submitted", "Only a submitted task can be returned");
        }
        String validComment = validComment(comment);
        status = TaskStatus.RETURNED;
        grade = null;
        teacherComment = validComment;
        reviewedAt = now;
    }

    public boolean isOverdue(@Nullable Instant dueAt, Instant now) {
        return dueAt != null && status.isOpen() && now.isAfter(dueAt);
    }

    public void markDueReminderSent(Instant now) {
        dueReminderSentAt = now;
    }

    /** Called by the repository after the task has been saved with a new version. */
    public void markSaved(long newVersion) {
        version = newVersion;
    }

    private static @Nullable String validGrade(@Nullable String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() > MAX_GRADE) {
            throw new BusinessRuleException("task.grade-invalid", "Grade is too long");
        }
        return trimmed;
    }

    private static @Nullable String validComment(@Nullable String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (value.length() > MAX_COMMENT) {
            throw new BusinessRuleException("task.comment-invalid", "Comment is too long");
        }
        return value.strip();
    }

    public UUID id() {
        return id;
    }

    public UUID assignmentId() {
        return assignmentId;
    }

    public UUID studentId() {
        return studentId;
    }

    public TaskStatus status() {
        return status;
    }

    public @Nullable String grade() {
        return grade;
    }

    public @Nullable String teacherComment() {
        return teacherComment;
    }

    public Instant assignedAt() {
        return assignedAt;
    }

    public @Nullable Instant submittedAt() {
        return submittedAt;
    }

    public @Nullable Instant reviewedAt() {
        return reviewedAt;
    }

    public @Nullable Instant dueReminderSentAt() {
        return dueReminderSentAt;
    }

    public long version() {
        return version;
    }
}

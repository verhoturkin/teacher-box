package ru.teacherbox.schedule.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * A student's request to move a lesson to another time or to cancel it; the teacher answers it. A guardian may
 * send it on the child's behalf (ADR-0069): the request is still the child's, {@link #requestedBy()} names the
 * guardian.
 */
public final class ChangeRequest {

    private final UUID id;
    private final UUID lessonId;
    private final UUID studentId;
    private final UUID requestedBy;
    private final ChangeKind kind;
    private final @Nullable Instant proposedStartsAt;
    private final @Nullable String comment;
    private RequestStatus status;
    private @Nullable String resolutionComment;
    private final Instant createdAt;
    private @Nullable Instant resolvedAt;
    private long version;

    private ChangeRequest(UUID id, UUID lessonId, UUID studentId, UUID requestedBy, ChangeKind kind, @Nullable Instant proposedStartsAt,
            @Nullable String comment, RequestStatus status, @Nullable String resolutionComment, Instant createdAt,
            @Nullable Instant resolvedAt, long version) {
        this.id = Objects.requireNonNull(id);
        this.lessonId = Objects.requireNonNull(lessonId);
        this.studentId = Objects.requireNonNull(studentId);
        this.requestedBy = Objects.requireNonNull(requestedBy);
        this.kind = Objects.requireNonNull(kind);
        this.proposedStartsAt = proposedStartsAt;
        this.comment = comment;
        this.status = Objects.requireNonNull(status);
        this.resolutionComment = resolutionComment;
        this.createdAt = Objects.requireNonNull(createdAt);
        this.resolvedAt = resolvedAt;
        this.version = version;
    }

    /**
     * @param proposedStartsAt required for {@link ChangeKind#RESCHEDULE} and must be in the future;
     *                         not allowed for {@link ChangeKind#CANCEL}
     */
    public static ChangeRequest open(UUID id, Lesson lesson, UUID studentId, ChangeKind kind,
            @Nullable Instant proposedStartsAt, @Nullable String comment, Instant now) {
        return open(id, lesson, studentId, studentId, kind, proposedStartsAt, comment, now);
    }

    /**
     * @param requestedBy the student themselves or a guardian acting on their behalf
     */
    public static ChangeRequest open(UUID id, Lesson lesson, UUID studentId, UUID requestedBy, ChangeKind kind,
            @Nullable Instant proposedStartsAt, @Nullable String comment, Instant now) {
        if (!lesson.hasParticipant(studentId)) {
            throw new IllegalArgumentException("The student does not take part in the lesson");
        }
        if (lesson.status() != LessonStatus.SCHEDULED || !lesson.startsAt().isAfter(now)) {
            throw new BusinessRuleException("schedule.request-not-allowed",
                    "Only an upcoming planned lesson can be moved or cancelled");
        }
        if (kind == ChangeKind.RESCHEDULE && (proposedStartsAt == null || !proposedStartsAt.isAfter(now))) {
            throw new BusinessRuleException("schedule.proposed-time-invalid", "Propose a time in the future");
        }
        if (kind == ChangeKind.CANCEL && proposedStartsAt != null) {
            throw new BusinessRuleException("schedule.proposed-time-invalid", "A cancellation has no new time");
        }
        return new ChangeRequest(id, lesson.id(), studentId, requestedBy, kind, proposedStartsAt, Texts.optional(comment),
                RequestStatus.PENDING, null, now, null, 0);
    }

    public static ChangeRequest restore(UUID id, UUID lessonId, UUID studentId, UUID requestedBy, ChangeKind kind,
            @Nullable Instant proposedStartsAt, @Nullable String comment, RequestStatus status,
            @Nullable String resolutionComment, Instant createdAt, @Nullable Instant resolvedAt, long version) {
        return new ChangeRequest(id, lessonId, studentId, requestedBy, kind, proposedStartsAt, comment, status,
                resolutionComment,
                createdAt, resolvedAt, version);
    }

    public void approve(@Nullable String answer, Instant now) {
        resolve(RequestStatus.APPROVED, answer, now);
    }

    public void decline(@Nullable String answer, Instant now) {
        resolve(RequestStatus.DECLINED, answer, now);
    }

    public void withdraw(Instant now) {
        resolve(RequestStatus.WITHDRAWN, null, now);
    }

    /** The teacher changed or cancelled the lesson without answering the request. */
    public void outdate(Instant now) {
        resolve(RequestStatus.OUTDATED, null, now);
    }

    private void resolve(RequestStatus newStatus, @Nullable String answer, Instant now) {
        if (status != RequestStatus.PENDING) {
            throw new BusinessRuleException("schedule.request-resolved", "The request is already answered");
        }
        status = newStatus;
        resolutionComment = Texts.optional(answer);
        resolvedAt = now;
    }

    public UUID id() {
        return id;
    }

    public UUID lessonId() {
        return lessonId;
    }

    public UUID studentId() {
        return studentId;
    }

    /** Who sent the request: the student, or a guardian on their behalf. */
    public UUID requestedBy() {
        return requestedBy;
    }

    /** The guardian who sent the request on the child's behalf; {@code null}: the student did. */
    public @Nullable UUID guardianId() {
        return requestedBy.equals(studentId) ? null : requestedBy;
    }

    public ChangeKind kind() {
        return kind;
    }

    public @Nullable Instant proposedStartsAt() {
        return proposedStartsAt;
    }

    public @Nullable String comment() {
        return comment;
    }

    public RequestStatus status() {
        return status;
    }

    public @Nullable String resolutionComment() {
        return resolutionComment;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public @Nullable Instant resolvedAt() {
        return resolvedAt;
    }

    public long version() {
        return version;
    }

    /** Called by the repository after an update. */
    public void markSaved(long savedVersion) {
        version = savedVersion;
    }
}

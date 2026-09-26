package ru.teacherbox.schedule.domain;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * A planned lesson with one student. It is moved or cancelled while it is {@link LessonStatus#SCHEDULED};
 * after it has started the teacher marks the outcome, which charges the lesson. A marked outcome
 * can be corrected: every outcome gets its own completion id so that the charge can be revoked.
 */
public final class Lesson {

    public static final int MAX_DURATION_MINUTES = 600;

    private final UUID id;
    private final UUID studentId;
    private final @Nullable UUID seriesId;
    private final @Nullable LocalDate seriesDate;
    private Instant startsAt;
    private int durationMinutes;
    private @Nullable String topic;
    private @Nullable String meetingUrl;
    private LessonStatus status;
    private @Nullable CancelledBy cancelledBy;
    private @Nullable String cancelReason;
    private @Nullable Instant originalStartsAt;
    private @Nullable UUID completionId;
    private final Instant createdAt;
    private Instant updatedAt;
    private long version;

    private Lesson(UUID id, UUID studentId, @Nullable UUID seriesId, @Nullable LocalDate seriesDate, Instant startsAt,
            int durationMinutes, @Nullable String topic, @Nullable String meetingUrl, LessonStatus status,
            @Nullable CancelledBy cancelledBy, @Nullable String cancelReason, @Nullable Instant originalStartsAt,
            @Nullable UUID completionId, Instant createdAt, Instant updatedAt, long version) {
        this.id = Objects.requireNonNull(id);
        this.studentId = Objects.requireNonNull(studentId);
        this.seriesId = seriesId;
        this.seriesDate = seriesDate;
        this.startsAt = Objects.requireNonNull(startsAt);
        this.durationMinutes = durationMinutes;
        this.topic = topic;
        this.meetingUrl = meetingUrl;
        this.status = Objects.requireNonNull(status);
        this.cancelledBy = cancelledBy;
        this.cancelReason = cancelReason;
        this.originalStartsAt = originalStartsAt;
        this.completionId = completionId;
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = Objects.requireNonNull(updatedAt);
        this.version = version;
    }

    /**
     * @param seriesId   the series the lesson belongs to, or {@code null} for a single lesson
     * @param seriesDate the day of the series this lesson stands for (it stays when the lesson moves)
     */
    public static Lesson plan(UUID id, UUID studentId, @Nullable UUID seriesId, @Nullable LocalDate seriesDate,
            Instant startsAt, int durationMinutes, @Nullable String topic, @Nullable String meetingUrl, Instant now) {
        if ((seriesId == null) != (seriesDate == null)) {
            throw new IllegalArgumentException("A lesson of a series needs both the series and the date");
        }
        return new Lesson(id, studentId, seriesId, seriesDate, startsAt, Texts.duration(durationMinutes),
                Texts.optional(topic), Texts.meetingUrl(meetingUrl), LessonStatus.SCHEDULED, null, null, null, null,
                now, now, 0);
    }

    public static Lesson restore(UUID id, UUID studentId, @Nullable UUID seriesId, @Nullable LocalDate seriesDate,
            Instant startsAt, int durationMinutes, @Nullable String topic, @Nullable String meetingUrl,
            LessonStatus status, @Nullable CancelledBy cancelledBy, @Nullable String cancelReason,
            @Nullable Instant originalStartsAt, @Nullable UUID completionId, Instant createdAt, Instant updatedAt,
            long version) {
        return new Lesson(id, studentId, seriesId, seriesDate, startsAt, durationMinutes, topic, meetingUrl, status,
                cancelledBy, cancelReason, originalStartsAt, completionId, createdAt, updatedAt, version);
    }

    /**
     * Changes the time, duration, topic or link of a planned lesson. The first time the lesson moves,
     * its original start is kept (the lesson then no longer follows changes of its series).
     *
     * @return {@code true} if the start or the duration changed
     */
    public boolean edit(Instant newStartsAt, int newDurationMinutes, @Nullable String newTopic,
            @Nullable String newMeetingUrl, Instant now) {
        requireScheduled();
        int duration = Texts.duration(newDurationMinutes);
        boolean moved = !newStartsAt.equals(startsAt) || duration != durationMinutes;
        if (!newStartsAt.equals(startsAt) && originalStartsAt == null) {
            originalStartsAt = startsAt;
        }
        startsAt = newStartsAt;
        durationMinutes = duration;
        topic = Texts.optional(newTopic);
        meetingUrl = Texts.meetingUrl(newMeetingUrl);
        updatedAt = now;
        return moved;
    }

    public void cancel(CancelledBy by, @Nullable String reason, Instant now) {
        requireScheduled();
        status = LessonStatus.CANCELLED;
        cancelledBy = Objects.requireNonNull(by);
        cancelReason = Texts.optional(reason);
        updatedAt = now;
    }

    /** A late cancellation that the teacher charges: the lesson counts as missed. */
    public void chargeCancellation(CancelledBy by, @Nullable String reason, UUID newCompletionId, Instant now) {
        requireScheduled();
        status = LessonStatus.MISSED;
        cancelledBy = Objects.requireNonNull(by);
        cancelReason = Texts.optional(reason);
        completionId = Objects.requireNonNull(newCompletionId);
        updatedAt = now;
    }

    /**
     * Marks the outcome of a started lesson or corrects a marked one.
     *
     * @param outcome {@link LessonStatus#CONDUCTED} or {@link LessonStatus#MISSED}
     * @return the completion id of the replaced outcome, or {@code null} if the lesson was not completed
     * @throws BusinessRuleException if the lesson has not started, is cancelled or already has this outcome
     */
    public @Nullable UUID complete(LessonStatus outcome, UUID newCompletionId, Instant now) {
        if (!outcome.isCompleted()) {
            throw new BusinessRuleException("schedule.outcome-invalid", "The outcome must be conducted or missed");
        }
        if (status == LessonStatus.CANCELLED) {
            throw new BusinessRuleException("schedule.lesson-cancelled", "The lesson is cancelled");
        }
        if (status == outcome) {
            throw new BusinessRuleException("schedule.outcome-unchanged", "The lesson already has this outcome");
        }
        if (startsAt.isAfter(now)) {
            throw new BusinessRuleException("schedule.lesson-not-started", "The lesson has not started yet");
        }
        UUID previous = completionId;
        status = outcome;
        completionId = Objects.requireNonNull(newCompletionId);
        if (outcome == LessonStatus.CONDUCTED) {
            cancelledBy = null;
            cancelReason = null;
        }
        updatedAt = now;
        return previous;
    }

    /**
     * Withdraws the marked outcome: the lesson is planned again.
     *
     * @return the completion id to revoke
     */
    public UUID reopen(Instant now) {
        UUID previous = completionId;
        if (!status.isCompleted() || previous == null) {
            throw new BusinessRuleException("schedule.lesson-not-completed", "The lesson has no marked outcome");
        }
        status = LessonStatus.SCHEDULED;
        completionId = null;
        cancelledBy = null;
        cancelReason = null;
        updatedAt = now;
        return previous;
    }

    /** Whether the lesson occupies part of {@code [from, to)}. */
    public boolean overlaps(Instant from, Instant to) {
        return startsAt.isBefore(to) && endsAt().isAfter(from);
    }

    private void requireScheduled() {
        if (status != LessonStatus.SCHEDULED) {
            throw new BusinessRuleException("schedule.lesson-not-scheduled",
                    "Only a planned lesson can be changed; this one is " + status);
        }
    }

    public UUID id() {
        return id;
    }

    public UUID studentId() {
        return studentId;
    }

    public @Nullable UUID seriesId() {
        return seriesId;
    }

    public @Nullable LocalDate seriesDate() {
        return seriesDate;
    }

    public Instant startsAt() {
        return startsAt;
    }

    public Instant endsAt() {
        return startsAt.plus(Duration.ofMinutes(durationMinutes));
    }

    public int durationMinutes() {
        return durationMinutes;
    }

    public @Nullable String topic() {
        return topic;
    }

    public @Nullable String meetingUrl() {
        return meetingUrl;
    }

    public LessonStatus status() {
        return status;
    }

    public @Nullable CancelledBy cancelledBy() {
        return cancelledBy;
    }

    public @Nullable String cancelReason() {
        return cancelReason;
    }

    public @Nullable Instant originalStartsAt() {
        return originalStartsAt;
    }

    public @Nullable UUID completionId() {
        return completionId;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public long version() {
        return version;
    }

    /** Called by the repository after an update. */
    public void markSaved(long savedVersion) {
        version = savedVersion;
    }
}

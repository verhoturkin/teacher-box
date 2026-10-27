package ru.teacherbox.schedule.domain;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * A planned lesson with one student or with a group (ADR-0011). It is moved or cancelled while it
 * is {@link LessonStatus#SCHEDULED}; after it has started the teacher marks the attendance of every
 * participant, which charges them. A mark can be corrected: every charge gets its own completion id
 * so that it can be revoked.
 */
public final class Lesson {

    public static final int MAX_DURATION_MINUTES = 600;
    public static final int MAX_TOPIC = 500;
    public static final int MAX_SUMMARY = 4000;
    public static final int MAX_NEXT_PLAN = 1000;

    private final UUID id;
    private final @Nullable UUID groupId;
    private final List<Participant> participants;
    private @Nullable UUID seriesId;
    private @Nullable LocalDate seriesDate;
    private boolean individuallyChanged;
    private Instant startsAt;
    private int durationMinutes;
    private @Nullable String topic;
    private @Nullable String meetingUrl;
    private LessonStatus status;
    private @Nullable CancelledBy cancelledBy;
    private @Nullable String cancelReason;
    private @Nullable Instant originalStartsAt;
    private final Instant createdAt;
    private Instant updatedAt;
    private long version;
    private @Nullable String summary;
    private @Nullable String nextPlan;
    private @Nullable Instant summaryUpdatedAt;

    private Lesson(UUID id, @Nullable UUID groupId, Collection<Participant> participants, @Nullable UUID seriesId,
            @Nullable LocalDate seriesDate, Instant startsAt, int durationMinutes, @Nullable String topic,
            @Nullable String meetingUrl, LessonStatus status, @Nullable CancelledBy cancelledBy,
            @Nullable String cancelReason, @Nullable Instant originalStartsAt, Instant createdAt, Instant updatedAt,
            long version) {
        this.id = Objects.requireNonNull(id);
        this.groupId = groupId;
        this.participants = new ArrayList<>(participants);
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
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = Objects.requireNonNull(updatedAt);
        this.version = version;
        if (groupId == null && this.participants.size() != 1) {
            throw new IllegalArgumentException("A lesson without a group has exactly one student");
        }
    }

    /**
     * A lesson with one student.
     *
     * @param seriesId   the series the lesson belongs to, or {@code null} for a single lesson
     * @param seriesDate the day of the series this lesson stands for (it stays when the lesson moves)
     */
    public static Lesson plan(UUID id, UUID studentId, @Nullable UUID seriesId, @Nullable LocalDate seriesDate,
            Instant startsAt, int durationMinutes, @Nullable String topic, @Nullable String meetingUrl, Instant now) {
        return planned(id, null, List.of(studentId), seriesId, seriesDate, startsAt, durationMinutes, topic,
                meetingUrl, now);
    }

    /** A lesson of a group with its current members. */
    public static Lesson planForGroup(UUID id, UUID groupId, Collection<UUID> memberIds, @Nullable UUID seriesId,
            @Nullable LocalDate seriesDate, Instant startsAt, int durationMinutes, @Nullable String topic,
            @Nullable String meetingUrl, Instant now) {
        return planned(id, Objects.requireNonNull(groupId), memberIds, seriesId, seriesDate, startsAt,
                durationMinutes, topic, meetingUrl, now);
    }

    private static Lesson planned(UUID id, @Nullable UUID groupId, Collection<UUID> studentIds,
            @Nullable UUID seriesId, @Nullable LocalDate seriesDate, Instant startsAt, int durationMinutes,
            @Nullable String topic, @Nullable String meetingUrl, Instant now) {
        if ((seriesId == null) != (seriesDate == null)) {
            throw new IllegalArgumentException("A lesson of a series needs both the series and the date");
        }
        List<Participant> participants = studentIds.stream().distinct().map(Participant::expected).toList();
        return new Lesson(id, groupId, participants, seriesId, seriesDate, startsAt, Texts.duration(durationMinutes),
                Texts.optional(topic), Texts.meetingUrl(meetingUrl), LessonStatus.SCHEDULED, null, null, null, now, now,
                0);
    }

    public static Lesson restore(UUID id, @Nullable UUID groupId, Collection<Participant> participants,
            @Nullable UUID seriesId, @Nullable LocalDate seriesDate, Instant startsAt, int durationMinutes,
            @Nullable String topic, @Nullable String meetingUrl, LessonStatus status, @Nullable CancelledBy cancelledBy,
            @Nullable String cancelReason, @Nullable Instant originalStartsAt, Instant createdAt, Instant updatedAt,
            long version) {
        return new Lesson(id, groupId, participants, seriesId, seriesDate, startsAt, durationMinutes, topic,
                meetingUrl, status, cancelledBy, cancelReason, originalStartsAt, createdAt, updatedAt, version);
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
        individuallyChanged = true;
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

    /**
     * Cancels the planned lesson for everybody.
     *
     * @return participants whose charges to revoke: late cancellations in a group lesson charged in advance
     */
    public List<Participant> cancel(CancelledBy by, @Nullable String reason, Instant now) {
        requireScheduled();
        List<Participant> revoked = charged();
        participants.replaceAll(participant -> participant.completionId() == null ? participant
                : Participant.expected(participant.studentId()));
        status = LessonStatus.CANCELLED;
        cancelledBy = Objects.requireNonNull(by);
        cancelReason = Texts.optional(reason);
        individuallyChanged = true;
        updatedAt = now;
        return revoked;
    }

    /**
     * Checks that the lesson may be deleted: it was not held and nobody is charged for it (a planned
     * or cancelled lesson). A held or charged lesson is corrected, not deleted.
     */
    public void requireDeletable() {
        if ((status != LessonStatus.SCHEDULED && status != LessonStatus.CANCELLED) || !charged().isEmpty()) {
            throw new BusinessRuleException("schedule.lesson-charged",
                    "A held or charged lesson cannot be deleted; withdraw its outcome first");
        }
    }

    /** Puts a cancelled lesson back into the schedule; excused students of a group stay excused. */
    public void reinstate(Instant now) {
        if (status != LessonStatus.CANCELLED) {
            throw new BusinessRuleException("schedule.lesson-not-cancelled", "Only a cancelled lesson can be restored");
        }
        status = LessonStatus.SCHEDULED;
        cancelledBy = null;
        cancelReason = null;
        individuallyChanged = true;
        updatedAt = now;
    }

    /** A late cancellation of a lesson with one student that the teacher charges: it counts as missed. */
    public void chargeCancellation(CancelledBy by, @Nullable String reason, UUID newCompletionId, Instant now) {
        requireIndividual();
        requireScheduled();
        participants.set(0, new Participant(studentId(), Attendance.MISSED, Objects.requireNonNull(newCompletionId)));
        status = LessonStatus.MISSED;
        cancelledBy = Objects.requireNonNull(by);
        cancelReason = Texts.optional(reason);
        individuallyChanged = true;
        updatedAt = now;
    }

    /**
     * A participant of a planned group lesson will not come; the lesson goes on for the others.
     *
     * @param newCompletionId charges a late notice as a missed lesson; {@code null} excuses the student
     */
    public void excuse(UUID studentId, @Nullable UUID newCompletionId, Instant now) {
        if (!isGroup()) {
            throw new BusinessRuleException("schedule.lesson-not-group", "Cancel a lesson with one student instead");
        }
        requireScheduled();
        int index = indexOf(studentId);
        if (participants.get(index).attendance() != Attendance.EXPECTED) {
            throw new BusinessRuleException("schedule.participant-not-expected", "The student is already marked");
        }
        participants.set(index, newCompletionId == null
                ? new Participant(studentId, Attendance.EXCUSED, null)
                : new Participant(studentId, Attendance.MISSED, newCompletionId));
        individuallyChanged = true;
        updatedAt = now;
    }

    /**
     * Marks the outcome of a started lesson with one student or corrects it.
     *
     * @param outcome {@link LessonStatus#CONDUCTED} or {@link LessonStatus#MISSED}
     */
    public List<Participant.Change> complete(LessonStatus outcome, Supplier<UUID> newIds, Instant now) {
        if (!outcome.isCompleted()) {
            throw new BusinessRuleException("schedule.outcome-invalid", "The outcome must be conducted or missed");
        }
        if (isGroup()) {
            throw new BusinessRuleException("schedule.attendance-required", "Mark every student of a group lesson");
        }
        return markAttendance(Map.of(studentId(), outcome == LessonStatus.CONDUCTED ? Attendance.ATTENDED
                : Attendance.MISSED), newIds, now);
    }

    /**
     * Marks the attendance of every participant of a started lesson or corrects it. The lesson is
     * conducted when anybody attended, missed otherwise.
     *
     * @return changed participants with the charges to revoke and the new charges
     * @throws BusinessRuleException if the lesson has not started, is cancelled, a participant is not
     *                               marked, nobody attended or missed, or nothing changes
     */
    public List<Participant.Change> markAttendance(Map<UUID, Attendance> marks, Supplier<UUID> newIds, Instant now) {
        if (status == LessonStatus.CANCELLED) {
            throw new BusinessRuleException("schedule.lesson-cancelled", "The lesson is cancelled");
        }
        if (startsAt.isAfter(now)) {
            throw new BusinessRuleException("schedule.lesson-not-started", "The lesson has not started yet");
        }
        if (!marks.keySet().equals(Set.copyOf(studentIds())) || marks.containsValue(Attendance.EXPECTED)) {
            throw new BusinessRuleException("schedule.attendance-invalid", "Mark every student of the lesson");
        }
        if (marks.values().stream().noneMatch(Attendance::isCharged)) {
            throw new BusinessRuleException("schedule.attendance-empty", "Cancel the lesson if nobody came");
        }
        LessonStatus outcome = marks.containsValue(Attendance.ATTENDED) ? LessonStatus.CONDUCTED : LessonStatus.MISSED;
        List<Participant.Change> changes = new ArrayList<>();
        for (int index = 0; index < participants.size(); index++) {
            Participant current = participants.get(index);
            Attendance mark = marks.get(current.studentId());
            if (mark == null || mark == current.attendance()) {
                continue;
            }
            UUID completionId = mark.isCharged() ? newIds.get() : null;
            participants.set(index, new Participant(current.studentId(), mark, completionId));
            changes.add(new Participant.Change(current.studentId(), mark, current.completionId(), completionId));
        }
        if (changes.isEmpty() && status == outcome) {
            throw new BusinessRuleException("schedule.outcome-unchanged", "The lesson already has this outcome");
        }
        status = outcome;
        if (outcome == LessonStatus.CONDUCTED) {
            cancelledBy = null;
            cancelReason = null;
        }
        individuallyChanged = true;
        updatedAt = now;
        return List.copyOf(changes);
    }

    /**
     * Withdraws the marked outcome: the lesson is planned again; excused students stay excused.
     *
     * @return participants whose charges to revoke
     */
    public List<Participant> reopen(Instant now) {
        if (!status.isCompleted()) {
            throw new BusinessRuleException("schedule.lesson-not-completed", "The lesson has no marked outcome");
        }
        List<Participant> revoked = charged();
        participants.replaceAll(participant -> participant.attendance() == Attendance.EXCUSED ? participant
                : Participant.expected(participant.studentId()));
        status = LessonStatus.SCHEDULED;
        cancelledBy = null;
        cancelReason = null;
        individuallyChanged = true;
        updatedAt = now;
        return revoked;
    }

    /**
     * A new member of the group joins the lesson.
     *
     * @return {@code false} if the lesson is not planned any more or the student is already there
     */
    public boolean addParticipant(UUID studentId, Instant now) {
        if (!isGroup() || status != LessonStatus.SCHEDULED || hasParticipant(studentId)) {
            return false;
        }
        participants.add(Participant.expected(studentId));
        updatedAt = now;
        return true;
    }

    /**
     * A student who left the group leaves the planned lesson, unless already charged for it.
     *
     * @return {@code true} if the student was removed
     */
    public boolean removeParticipant(UUID studentId, Instant now) {
        if (!isGroup() || status != LessonStatus.SCHEDULED) {
            return false;
        }
        boolean removed = participants.removeIf(participant -> participant.studentId().equals(studentId)
                && participant.completionId() == null);
        if (removed) {
            updatedAt = now;
        }
        return removed;
    }

    /** Whether the lesson occupies part of {@code [from, to)}. */
    public boolean overlaps(Instant from, Instant to) {
        return startsAt.isBefore(to) && endsAt().isAfter(from);
    }

    private List<Participant> charged() {
        return participants.stream().filter(participant -> participant.completionId() != null).toList();
    }

    private int indexOf(UUID studentId) {
        for (int index = 0; index < participants.size(); index++) {
            if (participants.get(index).studentId().equals(studentId)) {
                return index;
            }
        }
        throw new BusinessRuleException("schedule.participant-not-found", "The student does not take part");
    }

    private void requireScheduled() {
        if (status != LessonStatus.SCHEDULED) {
            throw new BusinessRuleException("schedule.lesson-not-scheduled",
                    "Only a planned lesson can be changed; this one is " + status);
        }
    }

    private void requireIndividual() {
        if (isGroup()) {
            throw new BusinessRuleException("schedule.lesson-group", "The lesson is a group lesson");
        }
    }

    public void repeatWith(@Nullable UUID ruleId, LocalDate originalDate) {
        seriesId = ruleId;
        if (seriesDate == null) seriesDate = originalDate;
    }

    public boolean individuallyChanged() {
        return individuallyChanged;
    }

    /** Restores the lesson summary kept outside the optimistic lock of the lesson. */
    public Lesson restoreSummary(@Nullable String summaryText, @Nullable String nextPlanText,
            @Nullable Instant updatedAt) {
        summary = summaryText;
        nextPlan = nextPlanText;
        summaryUpdatedAt = updatedAt;
        return this;
    }

    /**
     * Writes «what we covered» and «what next»; blank text clears a field. Does not touch the version:
     * the summary is not part of the time edits the version protects.
     */
    public void writeSummary(@Nullable String newSummary, @Nullable String newNextPlan, Instant now) {
        requireNotCancelled();
        summary = bounded(newSummary, MAX_SUMMARY);
        nextPlan = bounded(newNextPlan, MAX_NEXT_PLAN);
        summaryUpdatedAt = now;
    }

    /** Checks that a private note about the student may be written. */
    public void requireNoteFor(UUID studentId) {
        requireNotCancelled();
        if (!hasParticipant(studentId)) {
            throw new BusinessRuleException("schedule.not-a-participant", "The student is not in this lesson");
        }
    }

    /** Normalizes a private note: trimmed, {@code null} when blank. */
    public static @Nullable String note(@Nullable String text) {
        return bounded(text, MAX_SUMMARY);
    }

    private void requireNotCancelled() {
        if (status == LessonStatus.CANCELLED) {
            throw new BusinessRuleException("schedule.lesson-cancelled", "A cancelled lesson has no summary");
        }
    }

    private static @Nullable String bounded(@Nullable String text, int max) {
        String trimmed = text == null ? "" : text.strip();
        if (trimmed.length() > max) {
            throw new BusinessRuleException("schedule.summary-too-long",
                    "Text must not exceed " + max + " characters");
        }
        return trimmed.isEmpty() ? null : trimmed;
    }

    public @Nullable String summary() {
        return summary;
    }

    public @Nullable String nextPlan() {
        return nextPlan;
    }

    public @Nullable Instant summaryUpdatedAt() {
        return summaryUpdatedAt;
    }

    public Lesson restoreException(boolean changed) {
        individuallyChanged = changed;
        return this;
    }

    public UUID id() {
        return id;
    }

    public @Nullable UUID groupId() {
        return groupId;
    }

    public boolean isGroup() {
        return groupId != null;
    }

    /**
     * The student of a lesson with one student.
     *
     * @throws IllegalStateException for a group lesson
     */
    public UUID studentId() {
        if (isGroup()) {
            throw new IllegalStateException("A group lesson has several students");
        }
        return participants.getFirst().studentId();
    }

    public List<Participant> participants() {
        return List.copyOf(participants);
    }

    public List<UUID> studentIds() {
        return participants.stream().map(Participant::studentId).toList();
    }

    /** Students who are expected to come: not excused and not charged in advance. */
    public List<UUID> expectedIds() {
        return participants.stream()
                .filter(participant -> participant.attendance() == Attendance.EXPECTED)
                .map(Participant::studentId)
                .toList();
    }

    public Optional<Participant> participant(UUID studentId) {
        return participants.stream().filter(participant -> participant.studentId().equals(studentId)).findFirst();
    }

    public boolean hasParticipant(UUID studentId) {
        return participant(studentId).isPresent();
    }

    /** Attendance of every participant (for building a correction of the marks). */
    public Map<UUID, Attendance> attendance() {
        return participants.stream().collect(Collectors.toMap(Participant::studentId, Participant::attendance));
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

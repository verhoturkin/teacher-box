package ru.teacherbox.schedule.application;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.LessonRepeatScheduled;
import ru.teacherbox.schedule.api.LessonRepeatStopped;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.domain.Attendance;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.schedule.domain.Participant;
import ru.teacherbox.schedule.domain.RepeatRule;
import ru.teacherbox.schedule.persistence.ChangeRequestRepository;
import ru.teacherbox.schedule.persistence.LessonRepository;
import ru.teacherbox.schedule.persistence.RepeatRuleRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** The teacher's changes of the schedule: lessons and series with a student or a group, attendance. */
@Service
public class ScheduleService {

    /** Reason of the lessons cancelled because their group was archived. */
    static final String GROUP_ARCHIVED = "Группа в архиве";

    /**
     * A lesson with a student or with a group (exactly one of the two).
     *
     * @param durationMinutes defaults to the configured duration
     * @param allowOverlap    plan even if the time overlaps another lesson
     */
    public record PlanLesson(@Nullable UUID studentId, @Nullable UUID groupId, Instant startsAt,
            @Nullable Integer durationMinutes, @Nullable String title, @Nullable String topic,
            @Nullable String meetingUrl, boolean allowOverlap) {
    }

    /** @param topic what this lesson covers; a series edit never copies it to the following lessons */
    public record EditLesson(Instant startsAt, int durationMinutes, @Nullable String title, @Nullable String topic,
            @Nullable String meetingUrl, boolean allowOverlap) {
    }

    /**
     * @param byStudent the student asked for the cancellation (e.g. by phone)
     * @param charge    charge a late cancellation by the student as a missed lesson
     */
    public record CancelLesson(@Nullable String reason, boolean byStudent, boolean charge) {
    }

    private final LessonRepository lessons;
    private final RepeatRuleRepository series;
    private final ChangeRequestRepository requests;
    private final ScheduleDirectory directory;
    private final ScheduleQueries queries;
    private final LessonEvents lessonEvents;
    private final ApplicationEventPublisher events;
    private final ScheduleProperties properties;
    private final ZoneId zone;
    private final Clock clock;

    public ScheduleService(LessonRepository lessons, RepeatRuleRepository series, ChangeRequestRepository requests,
            ScheduleDirectory directory, ScheduleQueries queries, LessonEvents lessonEvents,
            ApplicationEventPublisher events, ScheduleProperties properties, InstanceTimeZone timeZone, Clock clock) {
        this.lessons = lessons;
        this.series = series;
        this.requests = requests;
        this.directory = directory;
        this.queries = queries;
        this.lessonEvents = lessonEvents;
        this.events = events;
        this.properties = properties;
        this.zone = timeZone.zoneId();
        this.clock = clock;
    }

    @Transactional
    public LessonView plan(PlanLesson command) {
        return plan(command, true);
    }

    LessonView plan(PlanLesson command, boolean notify) {
        int duration = command.durationMinutes() == null ? properties.defaultDuration() : command.durationMinutes();
        Instant now = clock.instant();
        UUID groupId = owner(command.studentId(), command.groupId());
        Lesson lesson;
        if (groupId != null) {
            List<UUID> members = requireMembers(groupId);
            lesson = Lesson.planForGroup(Ids.newId(), groupId, members, null, null, command.startsAt(), duration,
                    command.title(), command.meetingUrl(), now);
        } else {
            UUID studentId = directory.currentStudent(required(command.studentId())).id();
            lesson = Lesson.plan(Ids.newId(), studentId, null, null, command.startsAt(), duration, command.title(),
                    command.meetingUrl(), now);
        }
        lesson.describe(command.topic());
        requireFree(lesson.startsAt(), lesson.endsAt(), null, command.allowOverlap());
        lessons.insert(lesson);
        if (notify) lessonEvents.scheduled(lesson, now);
        return queries.lesson(lesson.id());
    }

    @Transactional
    public LessonView edit(UUID lessonId, EditLesson command) {
        Lesson lesson = find(lessonId);
        Instant previousStart = lesson.startsAt();
        Instant now = clock.instant();
        boolean moved = lesson.edit(command.startsAt(), command.durationMinutes(), command.title(),
                command.meetingUrl(), now);
        lesson.describe(command.topic());
        if (moved) {
            requireFree(lesson.startsAt(), lesson.endsAt(), lesson.id(), command.allowOverlap());
        }
        lessons.update(lesson);
        if (moved) {
            lessons.clearReminders(lesson.id());
            outdatePendingRequests(lesson.id(), now);
            lessonEvents.rescheduled(lesson, previousStart, null, now);
        }
        return queries.lesson(lesson.id());
    }

    @Transactional
    public LessonView cancel(UUID lessonId, CancelLesson command) {
        Lesson lesson = find(lessonId);
        if (command.charge() && (!command.byStudent() || lesson.isGroup())) {
            throw new BusinessRuleException("schedule.charge-invalid",
                    "Only a cancellation by the student of a lesson with one student can be charged");
        }
        if (command.byStudent() && lesson.isGroup()) {
            throw new BusinessRuleException("schedule.lesson-group",
                    "A student cancels only their own participation in a group lesson");
        }
        Instant now = clock.instant();
        CancelledBy by = command.byStudent() ? CancelledBy.STUDENT : CancelledBy.TEACHER;
        UUID completionId = command.charge() ? Ids.newId() : null;
        List<Participant> revoked = List.of();
        if (completionId != null) {
            lesson.chargeCancellation(by, command.reason(), completionId, now);
        } else {
            revoked = lesson.cancel(by, command.reason(), now);
        }
        lessons.update(lesson);
        outdatePendingRequests(lesson.id(), now);
        lessonEvents.revoked(lesson, revoked, now);
        lessonEvents.cancelled(lesson, by, completionId != null, false, now);
        if (completionId != null) {
            lessonEvents.completed(lesson, lesson.studentId(), completionId, true, now);
        }
        return queries.lesson(lesson.id());
    }

    /**
     * Writes the summary and the plan of a lesson (blank clears). A non-empty plan goes into the topic of
     * the next planned lesson of the same participants if that topic is empty; a filled one stays.
     */
    @Transactional
    public LessonView updateSummary(UUID lessonId, @Nullable String summary, @Nullable String nextPlan) {
        Lesson lesson = find(lessonId);
        lesson.writeSummary(summary, nextPlan, clock.instant());
        lessons.updateSummary(lesson);
        String plan = lesson.nextPlan();
        if (plan != null) {
            String topic = plan.length() > Lesson.MAX_TOPIC ? plan.substring(0, Lesson.MAX_TOPIC) : plan;
            lessons.findNextPlanned(lesson).ifPresent(next -> lessons.fillEmptyTopic(next.id(), topic));
        }
        return queries.lesson(lessonId);
    }

    /** Sends the written summary to the participants; an empty summary is not sent. */
    @Transactional
    public void shareSummary(UUID lessonId) {
        Lesson lesson = find(lessonId);
        lesson.requireSummarizable(clock.instant());
        if (lesson.summary() == null) {
            throw new BusinessRuleException("schedule.summary-empty", "Write the summary before sending it");
        }
        lessonEvents.summaryShared(lesson, directory.teacherId(), clock.instant());
    }

    /** Writes the teacher's private note about a participant (blank deletes it). */
    @Transactional
    public LessonView updateNote(UUID lessonId, UUID studentId, @Nullable String note) {
        Lesson lesson = find(lessonId);
        lesson.requireNoteFor(studentId, clock.instant());
        lessons.saveNote(lessonId, studentId, Lesson.note(note), clock.instant());
        return queries.lesson(lessonId);
    }

    /** Deletes a lesson that was not held: a planned or cancelled one nobody is charged for. */
    @Transactional
    public void delete(UUID lessonId) {
        Lesson lesson = find(lessonId);
        lesson.requireDeletable();
        lessons.delete(lesson);
        lessonEvents.deleted(lesson, clock.instant());
    }

    /**
     * Puts a cancelled lesson back into the schedule; a lesson that has already passed waits for its
     * outcome.
     *
     * @param allowOverlap restore even if another lesson took the time
     */
    @Transactional
    public LessonView reinstate(UUID lessonId, boolean allowOverlap) {
        Lesson lesson = find(lessonId);
        Instant now = clock.instant();
        lesson.reinstate(now);
        requireFree(lesson.startsAt(), lesson.endsAt(), lesson.id(), allowOverlap);
        lessons.update(lesson);
        lessonEvents.restored(lesson, now);
        return queries.lesson(lesson.id());
    }

    /** Marks the outcome of a started lesson with one student, or corrects it. */
    @Transactional
    public LessonView setOutcome(UUID lessonId, LessonStatus outcome) {
        Lesson lesson = find(lessonId);
        Instant now = clock.instant();
        List<Participant.Change> changes = lesson.complete(outcome, Ids::newId, now);
        return saveMarks(lesson, changes, now);
    }

    /** Marks the attendance of every participant of a started lesson, or corrects it. */
    @Transactional
    public LessonView markAttendance(UUID lessonId, Map<UUID, Attendance> marks) {
        Lesson lesson = find(lessonId);
        Instant now = clock.instant();
        List<Participant.Change> changes = lesson.markAttendance(marks, Ids::newId, now);
        return saveMarks(lesson, changes, now);
    }

    /** Withdraws the marked outcome: the lesson is planned again and its charges are revoked. */
    @Transactional
    public LessonView reopen(UUID lessonId) {
        Lesson lesson = find(lessonId);
        Instant now = clock.instant();
        List<Participant> revoked = lesson.reopen(now);
        lessons.update(lesson);
        lessonEvents.revoked(lesson, revoked, now);
        return queries.lesson(lesson.id());
    }

    /**
     * Creates the lessons of every active series up to the horizon (runs nightly).
     *
     * @return number of created lessons
     */
    @Transactional
    public int generateOccurrences() {
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, zone);
        LocalDate until = today.plusDays(properties.horizonDays());
        int created = 0;
        for (RepeatRule active : series.findActive(today)) {
            if (!active.generatedUntil().isBefore(until) || !active.continuesAfter(active.generatedUntil())) {
                continue;
            }
            LocalDate next = active.generatedUntil().plusDays(1);
            created += generate(active, next.isBefore(today) ? today : next, until, now);
            series.update(active);
        }
        return created;
    }

    /** The members of a group changed: planned future lessons of the group follow (past ones stay). */
    @Transactional
    public void syncGroupMembers(UUID groupId, Collection<UUID> added, Collection<UUID> removed) {
        Instant now = clock.instant();
        for (Lesson lesson : lessons.findScheduledOfGroup(groupId, now)) {
            boolean changed = false;
            for (UUID studentId : removed) {
                changed |= lesson.removeParticipant(studentId, now);
            }
            for (UUID studentId : added) {
                changed |= lesson.addParticipant(studentId, now);
            }
            if (changed) {
                lessons.update(lesson);
            }
        }
    }

    /** An archived group has no future lessons: its series stop and planned lessons are cancelled. */
    @Transactional
    public void stopGroup(UUID groupId) {
        Instant now = clock.instant();
        LocalDate tomorrow = LocalDate.ofInstant(now, zone).plusDays(1);
        for (RepeatRule active : series.findActive(tomorrow)) {
            if (groupId.equals(active.groupId())) {
                stop(active, tomorrow, false);
            }
        }
        for (Lesson lesson : lessons.findScheduledOfGroup(groupId, now)) {
            List<Participant> revoked = lesson.cancel(CancelledBy.TEACHER, GROUP_ARCHIVED, now);
            lessons.update(lesson);
            outdatePendingRequests(lesson.id(), now);
            lessonEvents.revoked(lesson, revoked, now);
            lessonEvents.cancelled(lesson, CancelledBy.TEACHER, false, false, now);
        }
    }

    private LessonView saveMarks(Lesson lesson, List<Participant.Change> changes, Instant now) {
        lessons.update(lesson);
        outdatePendingRequests(lesson.id(), now);
        lessonEvents.charges(lesson, changes, now);
        return queries.lesson(lesson.id());
    }

    private void stop(RepeatRule stopped, LocalDate from, boolean replaced) {
        Instant now = clock.instant();
        if (stopped.endBefore(from, now)) {
            series.update(stopped);
        }
        lessons.deleteUntouchedOfSeries(stopped.id(), from);
        UUID studentId = stopped.studentId();
        List<UUID> students = studentId != null ? List.of(studentId) : directory.membersOf(required(stopped.groupId()));
        events.publishEvent(new LessonRepeatStopped(null, stopped.groupId(), students, from, replaced, now));
    }

    int generate(RepeatRule source, LocalDate from, LocalDate until, Instant now) {
        UUID groupId = source.groupId();
        List<UUID> members = groupId == null ? List.of() : directory.membersOf(groupId);
        int created = 0;
        for (LocalDate date : source.datesBetween(from, until)) {
            if (lessons.existsForSeriesDate(source.id(), date)) {
                continue;
            }
            Instant start = source.startOn(date, zone);
            lessons.insert(groupId == null
                    ? Lesson.plan(Ids.newId(), required(source.studentId()), source.id(), date, start,
                            source.durationMinutes(), source.title(), source.meetingUrl(), now)
                    : Lesson.planForGroup(Ids.newId(), groupId, members, source.id(), date, start,
                            source.durationMinutes(), source.title(), source.meetingUrl(), now));
            created++;
        }
        source.generatedThrough(until, now);
        return created;
    }

    void requireFree(Instant from, Instant to, @Nullable UUID except, boolean allowOverlap) {
        if (allowOverlap) {
            return;
        }
        boolean busy = lessons.findOverlapping(from, to).stream().anyMatch(other -> !other.id().equals(except));
        if (busy) {
            throw new ConflictException("schedule.overlap", "The time overlaps another lesson");
        }
    }

    /** Requests about a lesson the teacher changed directly are no longer relevant. */
    void outdatePendingRequests(UUID lessonId, Instant now) {
        requests.findPendingForLesson(lessonId).forEach(request -> {
            request.outdate(now);
            requests.update(request);
        });
    }

    /**
     * Checks that exactly one owner is given.
     *
     * @return the group, or {@code null} for a lesson with one student
     */
    private static @Nullable UUID owner(@Nullable UUID studentId, @Nullable UUID groupId) {
        if ((studentId == null) == (groupId == null)) {
            throw new BusinessRuleException("schedule.owner-invalid", "Choose either a student or a group");
        }
        return groupId;
    }

    private List<UUID> requireMembers(UUID groupId) {
        List<UUID> members = directory.currentGroup(groupId).memberIds();
        if (members.isEmpty()) {
            throw new BusinessRuleException("schedule.group-empty", "Add students to the group first");
        }
        return members;
    }

    private static UUID required(@Nullable UUID id) {
        if (id == null) {
            throw new IllegalStateException("Missing id");
        }
        return id;
    }

    private Lesson find(UUID lessonId) {
        return lessons.findById(lessonId)
                .orElseThrow(() -> new NotFoundException("schedule.lesson-not-found", "Lesson not found"));
    }


}

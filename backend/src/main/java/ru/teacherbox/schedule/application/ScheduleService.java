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
import ru.teacherbox.schedule.api.SeriesScheduled;
import ru.teacherbox.schedule.api.SeriesStopped;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.SeriesPlanned;
import ru.teacherbox.schedule.application.ScheduleViews.SeriesView;
import ru.teacherbox.schedule.domain.Attendance;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.schedule.domain.Participant;
import ru.teacherbox.schedule.domain.Series;
import ru.teacherbox.schedule.persistence.ChangeRequestRepository;
import ru.teacherbox.schedule.persistence.LessonRepository;
import ru.teacherbox.schedule.persistence.SeriesRepository;
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
            @Nullable Integer durationMinutes, @Nullable String topic, @Nullable String meetingUrl,
            boolean allowOverlap) {
    }

    public record EditLesson(Instant startsAt, int durationMinutes, @Nullable String topic,
            @Nullable String meetingUrl, boolean allowOverlap) {
    }

    /**
     * @param byStudent the student asked for the cancellation (e.g. by phone)
     * @param charge    charge a late cancellation by the student as a missed lesson
     */
    public record CancelLesson(@Nullable String reason, boolean byStudent, boolean charge) {
    }

    /**
     * Regular lessons with a student or with a group (exactly one of the two).
     *
     * @param startTime local time in the instance time zone
     * @param startsOn  first day of the series (for a change: the day the change applies from)
     */
    public record PlanSeries(@Nullable UUID studentId, @Nullable UUID groupId, Set<DayOfWeek> weekdays,
            LocalTime startTime, @Nullable Integer durationMinutes, int intervalWeeks, LocalDate startsOn,
            @Nullable LocalDate endsOn, @Nullable String topic, @Nullable String meetingUrl, boolean allowOverlap) {
    }

    private final LessonRepository lessons;
    private final SeriesRepository series;
    private final ChangeRequestRepository requests;
    private final ScheduleDirectory directory;
    private final ScheduleQueries queries;
    private final LessonEvents lessonEvents;
    private final ApplicationEventPublisher events;
    private final ScheduleProperties properties;
    private final ZoneId zone;
    private final Clock clock;

    public ScheduleService(LessonRepository lessons, SeriesRepository series, ChangeRequestRepository requests,
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
        int duration = command.durationMinutes() == null ? properties.defaultDuration() : command.durationMinutes();
        Instant now = clock.instant();
        UUID groupId = owner(command.studentId(), command.groupId());
        Lesson lesson;
        if (groupId != null) {
            List<UUID> members = requireMembers(groupId);
            lesson = Lesson.planForGroup(Ids.newId(), groupId, members, null, null, command.startsAt(), duration,
                    command.topic(), command.meetingUrl(), now);
        } else {
            UUID studentId = directory.currentStudent(required(command.studentId())).id();
            lesson = Lesson.plan(Ids.newId(), studentId, null, null, command.startsAt(), duration, command.topic(),
                    command.meetingUrl(), now);
        }
        requireFree(lesson.startsAt(), lesson.endsAt(), null, command.allowOverlap());
        lessons.insert(lesson);
        lessonEvents.scheduled(lesson, now);
        return queries.lesson(lesson.id());
    }

    @Transactional
    public LessonView edit(UUID lessonId, EditLesson command) {
        Lesson lesson = find(lessonId);
        Instant previousStart = lesson.startsAt();
        Instant now = clock.instant();
        boolean moved = lesson.edit(command.startsAt(), command.durationMinutes(), command.topic(),
                command.meetingUrl(), now);
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

    @Transactional
    public SeriesPlanned planSeries(PlanSeries command) {
        Instant now = clock.instant();
        UUID groupId = owner(command.studentId(), command.groupId());
        List<UUID> students;
        if (groupId != null) {
            students = requireMembers(groupId);
        } else {
            students = List.of(directory.currentStudent(required(command.studentId())).id());
        }
        int duration = command.durationMinutes() == null ? properties.defaultDuration() : command.durationMinutes();
        Series created = Series.create(Ids.newId(), groupId == null ? students.getFirst() : null, groupId,
                command.weekdays(), command.startTime(), duration, command.intervalWeeks(), command.startsOn(),
                command.endsOn(), command.topic(), command.meetingUrl(), now);
        LocalDate today = LocalDate.ofInstant(now, zone);
        LocalDate from = created.startsOn().isBefore(today) ? today : created.startsOn();
        LocalDate until = today.plusDays(properties.horizonDays());
        if (!command.allowOverlap()) {
            for (LocalDate date : created.datesBetween(from, until)) {
                Instant start = created.startOn(date, zone);
                requireFree(start, start.plusSeconds(60L * created.durationMinutes()), null, false);
            }
        }
        series.insert(created);
        int generated = generate(created, from, until, now);
        series.update(created);
        events.publishEvent(new SeriesScheduled(created.id(), groupId, students, created.weekdays(),
                created.startTime(), created.durationMinutes(), created.intervalWeeks(), created.startsOn(),
                created.endsOn(), now));
        return new SeriesPlanned(SeriesView.of(created, directory.namesOfSeries(List.of(created))), generated);
    }

    /**
     * Changes a series from {@code command.startsOn()} on: the old series ends the day before and a
     * new one with the new settings continues. Lessons before that day and lessons moved
     * individually stay.
     */
    @Transactional
    public SeriesPlanned changeSeries(UUID seriesId, PlanSeries command) {
        Series current = findSeries(seriesId);
        if (!current.sameOwner(command.studentId(), command.groupId())) {
            throw new BusinessRuleException("schedule.series-student-fixed",
                    "A series belongs to one student or group");
        }
        stop(current, command.startsOn(), true);
        return planSeries(command);
    }

    /** Ends a series before {@code from}; its planned lessons from that day on are removed. */
    @Transactional
    public void stopSeries(UUID seriesId, LocalDate from) {
        stop(findSeries(seriesId), from, false);
    }

    /**
     * Creates the lessons of every active series up to the horizon (runs nightly).
     *
     * @return number of created lessons
     */
    @Transactional
    public int extendSeries() {
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, zone);
        LocalDate until = today.plusDays(properties.horizonDays());
        int created = 0;
        for (Series active : series.findActive(today)) {
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
        for (Series active : series.findActive(tomorrow)) {
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

    private void stop(Series stopped, LocalDate from, boolean replaced) {
        Instant now = clock.instant();
        if (stopped.endBefore(from, now)) {
            series.update(stopped);
        }
        lessons.deleteUntouchedOfSeries(stopped.id(), from);
        UUID studentId = stopped.studentId();
        List<UUID> students = studentId != null ? List.of(studentId) : directory.membersOf(required(stopped.groupId()));
        events.publishEvent(new SeriesStopped(stopped.id(), stopped.groupId(), students, from, replaced, now));
    }

    private int generate(Series source, LocalDate from, LocalDate until, Instant now) {
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
                            source.durationMinutes(), source.topic(), source.meetingUrl(), now)
                    : Lesson.planForGroup(Ids.newId(), groupId, members, source.id(), date, start,
                            source.durationMinutes(), source.topic(), source.meetingUrl(), now));
            created++;
        }
        source.generatedThrough(until, now);
        return created;
    }

    private void requireFree(Instant from, Instant to, @Nullable UUID except, boolean allowOverlap) {
        if (allowOverlap) {
            return;
        }
        boolean busy = lessons.findOverlapping(from, to).stream().anyMatch(other -> !other.id().equals(except));
        if (busy) {
            throw new ConflictException("schedule.overlap", "The time overlaps another lesson");
        }
    }

    /** Requests about a lesson the teacher changed directly are no longer relevant. */
    private void outdatePendingRequests(UUID lessonId, Instant now) {
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

    private Series findSeries(UUID seriesId) {
        return series.findById(seriesId)
                .orElseThrow(() -> new NotFoundException("schedule.series-not-found", "Series not found"));
    }
}

package ru.teacherbox.schedule.application;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.LessonCompleted;
import ru.teacherbox.schedule.api.LessonCompletionRevoked;
import ru.teacherbox.schedule.api.LessonRescheduled;
import ru.teacherbox.schedule.api.LessonScheduled;
import ru.teacherbox.schedule.api.ScheduledLessonCancelled;
import ru.teacherbox.schedule.api.SeriesScheduled;
import ru.teacherbox.schedule.api.SeriesStopped;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.RequestView;
import ru.teacherbox.schedule.application.ScheduleViews.SeriesPlanned;
import ru.teacherbox.schedule.application.ScheduleViews.SeriesView;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.schedule.domain.Series;
import ru.teacherbox.schedule.persistence.ChangeRequestRepository;
import ru.teacherbox.schedule.persistence.LessonRepository;
import ru.teacherbox.schedule.persistence.SeriesRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** The teacher's changes of the schedule: lessons, series and outcomes. */
@Service
public class ScheduleService {

    /**
     * @param durationMinutes defaults to the configured duration
     * @param allowOverlap    plan even if the time overlaps another lesson
     */
    public record PlanLesson(UUID studentId, Instant startsAt, @Nullable Integer durationMinutes,
            @Nullable String topic, @Nullable String meetingUrl, boolean allowOverlap) {
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
     * @param startTime local time in the instance time zone
     * @param startsOn  first day of the series (for a change: the day the change applies from)
     */
    public record PlanSeries(UUID studentId, Set<DayOfWeek> weekdays, LocalTime startTime,
            @Nullable Integer durationMinutes, int intervalWeeks, LocalDate startsOn, @Nullable LocalDate endsOn,
            @Nullable String topic, @Nullable String meetingUrl, boolean allowOverlap) {
    }

    private final LessonRepository lessons;
    private final SeriesRepository series;
    private final ChangeRequestRepository requests;
    private final UserDirectory directory;
    private final ApplicationEventPublisher events;
    private final ScheduleProperties properties;
    private final ZoneId zone;
    private final Clock clock;

    public ScheduleService(LessonRepository lessons, SeriesRepository series, ChangeRequestRepository requests,
            UserDirectory directory, ApplicationEventPublisher events, ScheduleProperties properties,
            InstanceTimeZone timeZone, Clock clock) {
        this.lessons = lessons;
        this.series = series;
        this.requests = requests;
        this.directory = directory;
        this.events = events;
        this.properties = properties;
        this.zone = timeZone.zoneId();
        this.clock = clock;
    }

    @Transactional
    public LessonView plan(PlanLesson command) {
        StudentSummary student = currentStudent(command.studentId());
        int duration = command.durationMinutes() == null ? properties.defaultDuration() : command.durationMinutes();
        Instant now = clock.instant();
        Lesson lesson = Lesson.plan(Ids.newId(), student.id(), null, null, command.startsAt(), duration,
                command.topic(), command.meetingUrl(), now);
        requireFree(lesson.startsAt(), lesson.endsAt(), null, command.allowOverlap());
        lessons.insert(lesson);
        events.publishEvent(new LessonScheduled(lesson.id(), lesson.studentId(), lesson.startsAt(),
                lesson.durationMinutes(), lesson.topic(), now));
        return LessonView.of(lesson, student.displayName(), null);
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
            outdatePendingRequest(lesson.id(), now);
            events.publishEvent(new LessonRescheduled(lesson.id(), lesson.studentId(), previousStart,
                    lesson.startsAt(), lesson.durationMinutes(), false, now));
        }
        return view(lesson);
    }

    @Transactional
    public LessonView cancel(UUID lessonId, CancelLesson command) {
        if (command.charge() && !command.byStudent()) {
            throw new BusinessRuleException("schedule.charge-invalid",
                    "Only a cancellation by the student can be charged");
        }
        Lesson lesson = find(lessonId);
        Instant now = clock.instant();
        CancelledBy by = command.byStudent() ? CancelledBy.STUDENT : CancelledBy.TEACHER;
        UUID completionId = command.charge() ? Ids.newId() : null;
        if (completionId != null) {
            lesson.chargeCancellation(by, command.reason(), completionId, now);
        } else {
            lesson.cancel(by, command.reason(), now);
        }
        lessons.update(lesson);
        outdatePendingRequest(lesson.id(), now);
        events.publishEvent(new ScheduledLessonCancelled(lesson.id(), lesson.studentId(), lesson.startsAt(), by,
                lesson.cancelReason(), completionId != null, false, now));
        if (completionId != null) {
            publishCompleted(lesson, completionId, now);
        }
        return view(lesson);
    }

    /** Marks the outcome of a lesson that has started, or corrects it. */
    @Transactional
    public LessonView setOutcome(UUID lessonId, LessonStatus outcome) {
        Lesson lesson = find(lessonId);
        Instant now = clock.instant();
        UUID completionId = Ids.newId();
        UUID replaced = lesson.complete(outcome, completionId, now);
        lessons.update(lesson);
        outdatePendingRequest(lesson.id(), now);
        if (replaced != null) {
            events.publishEvent(new LessonCompletionRevoked(replaced, lesson.id(), lesson.studentId(), now));
        }
        publishCompleted(lesson, completionId, now);
        return view(lesson);
    }

    /** Withdraws the marked outcome: the lesson is planned again and its charge is revoked. */
    @Transactional
    public LessonView reopen(UUID lessonId) {
        Lesson lesson = find(lessonId);
        Instant now = clock.instant();
        UUID revoked = lesson.reopen(now);
        lessons.update(lesson);
        events.publishEvent(new LessonCompletionRevoked(revoked, lesson.id(), lesson.studentId(), now));
        return view(lesson);
    }

    @Transactional
    public SeriesPlanned planSeries(PlanSeries command) {
        StudentSummary student = currentStudent(command.studentId());
        Instant now = clock.instant();
        int duration = command.durationMinutes() == null ? properties.defaultDuration() : command.durationMinutes();
        Series created = Series.create(Ids.newId(), student.id(), command.weekdays(), command.startTime(), duration,
                command.intervalWeeks(), command.startsOn(), command.endsOn(), command.topic(), command.meetingUrl(),
                now);
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
        events.publishEvent(new SeriesScheduled(created.id(), created.studentId(), created.weekdays(),
                created.startTime(), created.durationMinutes(), created.intervalWeeks(), created.startsOn(),
                created.endsOn(), now));
        return new SeriesPlanned(SeriesView.of(created, student.displayName()), generated);
    }

    /**
     * Changes a series from {@code command.startsOn()} on: the old series ends the day before and a
     * new one with the new settings continues. Lessons before that day and lessons moved
     * individually stay.
     */
    @Transactional
    public SeriesPlanned changeSeries(UUID seriesId, PlanSeries command) {
        Series current = findSeries(seriesId);
        if (!current.studentId().equals(command.studentId())) {
            throw new BusinessRuleException("schedule.series-student-fixed", "A series belongs to one student");
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

    private void stop(Series stopped, LocalDate from, boolean replaced) {
        Instant now = clock.instant();
        if (stopped.endBefore(from, now)) {
            series.update(stopped);
        }
        lessons.deleteUntouchedOfSeries(stopped.id(), from);
        events.publishEvent(new SeriesStopped(stopped.id(), stopped.studentId(), from, replaced, now));
    }

    private int generate(Series source, LocalDate from, LocalDate until, Instant now) {
        int created = 0;
        for (LocalDate date : source.datesBetween(from, until)) {
            if (!lessons.existsForSeriesDate(source.id(), date)) {
                lessons.insert(Lesson.plan(Ids.newId(), source.studentId(), source.id(), date,
                        source.startOn(date, zone), source.durationMinutes(), source.topic(), source.meetingUrl(),
                        now));
                created++;
            }
        }
        source.generatedThrough(until, now);
        return created;
    }

    private void publishCompleted(Lesson lesson, UUID completionId, Instant now) {
        events.publishEvent(new LessonCompleted(completionId, lesson.id(), lesson.studentId(),
                LocalDate.ofInstant(lesson.startsAt(), zone), lesson.durationMinutes(), lesson.topic(),
                lesson.status() == LessonStatus.MISSED, now));
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

    /** A request about a lesson the teacher changed directly is no longer relevant. */
    private void outdatePendingRequest(UUID lessonId, Instant now) {
        requests.findPendingForLesson(lessonId).ifPresent(request -> {
            request.outdate(now);
            requests.update(request);
        });
    }

    private StudentSummary currentStudent(UUID studentId) {
        return directory.findStudent(studentId)
                .filter(StudentSummary::isCurrent)
                .orElseThrow(() -> new NotFoundException("schedule.student-not-found", "Student not found"));
    }

    private Lesson find(UUID lessonId) {
        return lessons.findById(lessonId)
                .orElseThrow(() -> new NotFoundException("schedule.lesson-not-found", "Lesson not found"));
    }

    private Series findSeries(UUID seriesId) {
        return series.findById(seriesId)
                .orElseThrow(() -> new NotFoundException("schedule.series-not-found", "Series not found"));
    }

    private LessonView view(Lesson lesson) {
        String name = directory.findStudent(lesson.studentId()).map(StudentSummary::displayName).orElse(null);
        return LessonView.of(lesson, name, requests.findPendingForLesson(lesson.id())
                .map(request -> RequestView.of(request, lesson.startsAt(), name, properties.lateCancellation()))
                .orElse(null));
    }
}

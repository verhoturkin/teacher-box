package ru.teacherbox.schedule.application;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.MyScheduleSummary;
import ru.teacherbox.schedule.application.ScheduleViews.RequestView;
import ru.teacherbox.schedule.application.ScheduleViews.ScheduleSettings;
import ru.teacherbox.schedule.application.ScheduleViews.ScheduleSummary;
import ru.teacherbox.schedule.domain.ChangeRequest;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.schedule.domain.RequestStatus;
import ru.teacherbox.schedule.domain.RepeatRule;
import ru.teacherbox.schedule.persistence.ChangeRequestRepository;
import ru.teacherbox.schedule.persistence.LessonRepository;
import ru.teacherbox.schedule.persistence.RepeatRuleRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.time.InstanceTimeZone;

/**
 * Reading the schedule: the teacher sees everything, a student only their own lessons (alone and
 * with their groups) and requests.
 */
@Service
@Transactional(readOnly = true)
public class ScheduleQueries {

    /** Longest period of one calendar request. */
    static final int MAX_RANGE_DAYS = 400;
    private static final int STUDENT_REQUESTS = 20;
    /** Days of the «this week» counters, today included. */
    private static final int WEEK_DAYS = 7;

    private final LessonRepository lessons;
    private final RepeatRuleRepository series;
    private final ChangeRequestRepository requests;
    private final ScheduleDirectory directory;
    private final ScheduleProperties properties;
    private final ZoneId zone;
    private final Clock clock;

    public ScheduleQueries(LessonRepository lessons, RepeatRuleRepository series, ChangeRequestRepository requests,
            ScheduleDirectory directory, ScheduleProperties properties, InstanceTimeZone timeZone, Clock clock) {
        this.lessons = lessons;
        this.series = series;
        this.requests = requests;
        this.directory = directory;
        this.properties = properties;
        this.zone = timeZone.zoneId();
        this.clock = clock;
    }

    /** All lessons that start on days {@code [from, to)} of the instance time zone. */
    public List<LessonView> lessons(LocalDate from, LocalDate to) {
        return views(lessons.findStartingBetween(start(from, to), start(to)));
    }

    /**
     * The teacher's view of the lessons of one student (alone or in a group, whatever the attendance) or of one
     * group that start on days {@code [from, to)}; without either — all lessons.
     */
    public List<LessonView> lessons(LocalDate from, LocalDate to, @Nullable UUID studentId,
            @Nullable UUID groupId) {
        if (studentId != null && groupId != null) {
            throw new BusinessRuleException("schedule.filter-invalid", "Give a student or a group, not both");
        }
        Instant start = start(from, to);
        if (studentId != null) {
            return views(lessons.findStartingBetween(studentId, start, start(to)));
        }
        if (groupId != null) {
            return views(lessons.findStartingBetweenOfGroup(groupId, start, start(to)));
        }
        return views(lessons.findStartingBetween(start, start(to)));
    }

    public List<LessonView> studentLessons(UUID studentId, LocalDate from, LocalDate to) {
        return views(lessons.findStartingBetween(studentId, start(from, to), start(to))).stream()
                .map(view -> view.forStudent(studentId))
                .toList();
    }

    public LessonView lesson(UUID lessonId) {
        Lesson lesson = lessons.findById(lessonId).orElseThrow(ScheduleQueries::lessonNotFound);
        return views(List.of(lesson)).getFirst().withSummary(lesson, lessons.findNotes(lessonId));
    }

    /** A lesson of the student; a lesson the student does not take part in is reported as not found. */
    public LessonView studentLesson(UUID studentId, UUID lessonId) {
        Lesson lesson = lessons.findById(lessonId)
                .filter(found -> found.hasParticipant(studentId))
                .orElseThrow(ScheduleQueries::lessonNotFound);
        return views(List.of(lesson)).getFirst().forStudent(studentId).withStudentSummary(lesson);
    }

    /** Lessons that have ended but have no outcome yet, oldest first. */
    public List<LessonView> unmarked() {
        return views(lessons.findUnmarked(clock.instant()));
    }

    /** Unanswered requests of all students, oldest first. */
    public List<RequestView> pendingRequests() {
        return requestViews(requests.findPending());
    }

    /** The student's latest requests, newest first. */
    public List<RequestView> studentRequests(UUID studentId) {
        return requestViews(requests.findByStudent(studentId, STUDENT_REQUESTS));
    }

    public ScheduleSummary summary() {
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, zone);
        List<LessonView> week = lessons(today, today.plusDays(WEEK_DAYS));
        Instant tomorrow = start(today.plusDays(1));
        List<LessonView> upcoming = week.stream()
                .filter(lesson -> upcoming(lesson.status(), lesson.endsAt(), now))
                .sorted(Comparator.comparing(LessonView::startsAt))
                .toList();
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        List<Lesson> calendarWeek = lessons.findStartingBetween(start(monday), start(monday.plusDays(WEEK_DAYS)));
        return new ScheduleSummary(
                week.stream().filter(lesson -> lesson.startsAt().isBefore(tomorrow)).toList(),
                upcoming.isEmpty() ? null : upcoming.getFirst(),
                upcoming.size(),
                lessons.findUnmarked(now).size(),
                requests.findPending().size(),
                lessons.exists(),
                countStatus(calendarWeek, LessonStatus.CONDUCTED),
                countStatus(calendarWeek, LessonStatus.MISSED));
    }

    private static int countStatus(List<Lesson> lessons, LessonStatus status) {
        return Math.toIntExact(lessons.stream().filter(lesson -> lesson.status() == status).count());
    }

    public MyScheduleSummary studentSummary(UUID studentId) {
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, zone);
        LessonView next = lessons.findNextScheduled(studentId, now)
                .map(lesson -> views(List.of(lesson)).getFirst().forStudent(studentId))
                .orElse(null);
        long week = lessons.findStartingBetween(studentId, start(today), start(today.plusDays(WEEK_DAYS))).stream()
                .filter(lesson -> upcoming(lesson.status(), lesson.endsAt(), now))
                .filter(lesson -> lesson.expectedIds().contains(studentId))
                .count();
        long pending = requests.findByStudent(studentId, STUDENT_REQUESTS).stream()
                .filter(request -> request.status() == RequestStatus.PENDING)
                .count();
        return new MyScheduleSummary(next, Math.toIntExact(week), Math.toIntExact(pending));
    }

    public ScheduleSettings settings() {
        return new ScheduleSettings(zone.getId(), properties.defaultDuration(),
                properties.lateCancellation().toMinutes(),
                properties.reminders().stream().map(Duration::toMinutes).toList());
    }

    private List<LessonView> views(List<Lesson> found) {
        ScheduleNames names = directory.namesOf(found);
        Map<UUID, List<ChangeRequest>> pending = requests.findPendingForLessons(found.stream().map(Lesson::id).toList())
                .stream()
                .collect(Collectors.groupingBy(ChangeRequest::lessonId));
        Duration late = properties.lateCancellation();
        return found.stream()
                .map(lesson -> LessonView.of(lesson, names, pending.getOrDefault(lesson.id(), List.of()).stream()
                        .map(request -> RequestView.of(request, lesson, names, late))
                        .toList(), lesson.seriesId() == null ? null : series.findById(lesson.seriesId()).orElse(null)))
                .toList();
    }

    private List<RequestView> requestViews(List<ChangeRequest> found) {
        Map<UUID, Lesson> byId = new LinkedHashMap<>();
        for (ChangeRequest request : found) {
            byId.computeIfAbsent(request.lessonId(),
                    id -> lessons.findById(id).orElseThrow(ScheduleQueries::lessonNotFound));
        }
        Set<UUID> students = found.stream().map(ChangeRequest::studentId).collect(Collectors.toCollection(HashSet::new));
        Set<UUID> groups = byId.values().stream()
                .map(Lesson::groupId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        ScheduleNames names = directory.names(students, groups);
        return found.stream()
                .map(request -> RequestView.of(request, byId.get(request.lessonId()), names,
                        properties.lateCancellation()))
                .toList();
    }

    private Instant start(LocalDate from, LocalDate to) {
        if (!to.isAfter(from) || ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw new BusinessRuleException("schedule.range-invalid",
                    "The period must be 1-" + MAX_RANGE_DAYS + " days long");
        }
        return start(from);
    }

    private static boolean upcoming(LessonStatus status, Instant endsAt, Instant now) {
        return status == LessonStatus.SCHEDULED && endsAt.isAfter(now);
    }

    private Instant start(LocalDate day) {
        return day.atStartOfDay(zone).toInstant();
    }

    private static NotFoundException lessonNotFound() {
        return new NotFoundException("schedule.lesson-not-found", "Lesson not found");
    }
}

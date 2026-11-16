package ru.teacherbox.schedule.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.function.Predicate;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.persistence.LessonRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.time.InstanceTimeZone;

/**
 * When the teacher is busy: lessons that are not cancelled, the time the teacher does not work and, if
 * the teacher allowed reading it, the busy time of their Google Calendar. Students see only the
 * periods, never whose lessons they are.
 */
@Service
public class TeacherAvailability {

    /** Longest period of busy times in one request. */
    static final Duration MAX_RANGE = Duration.ofDays(62);

    /** Step between the offered free start times. */
    static final Duration FREE_TIME_STEP = Duration.ofMinutes(15);

    /** A period when the teacher is busy. */
    public record BusyTime(Instant start, Instant end) {
    }

    /** Busy times from outside the portal (the teacher's Google Calendar), if any. */
    public interface ExternalBusyTimes {

        List<BusyTime> busy(Instant from, Instant to);
    }

    private final LessonRepository lessons;
    private final OffTimeService offTime;
    private final ObjectProvider<ExternalBusyTimes> external;
    private final InstanceTimeZone timeZone;
    private final Clock clock;

    public TeacherAvailability(LessonRepository lessons, OffTimeService offTime,
            ObjectProvider<ExternalBusyTimes> external, InstanceTimeZone timeZone, Clock clock) {
        this.lessons = lessons;
        this.offTime = offTime;
        this.external = external;
        this.timeZone = timeZone;
        this.clock = clock;
    }

    /**
     * Free start times on {@code date} (the teacher's zone) to move the lesson to: from now on, every
     * {@link #FREE_TIME_STEP}, where the whole lesson misses other lessons, the off time and the
     * teacher's calendar. With a {@code studentId}, a lesson the student does not take part in is not
     * found.
     */
    @Transactional(readOnly = true)
    public List<Instant> freeTimes(@Nullable UUID studentId, UUID lessonId, LocalDate date) {
        Lesson moved = lessons.findById(lessonId)
                .filter(lesson -> studentId == null || lesson.hasParticipant(studentId))
                .orElseThrow(() -> new NotFoundException("schedule.lesson-not-found", "Lesson not found"));
        ZoneId zone = timeZone.zoneId();
        Instant from = date.atStartOfDay(zone).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(zone).toInstant();
        Duration length = Duration.between(moved.startsAt(), moved.endsAt());
        Instant now = clock.instant();
        if (!to.isAfter(now)) {
            return List.of();
        }
        return SlotFinder.freeStarts(from, to, now,
                busy(from, to.plus(length), lesson -> !lesson.id().equals(lessonId)), length, FREE_TIME_STEP);
    }

    /**
     * The teacher's busy periods in {@code [from, to)} as a student sees them: overlapping periods
     * merged, the student's own lessons left out (the student sees them as lessons).
     */
    @Transactional(readOnly = true)
    public List<BusyTime> forStudent(UUID studentId, Instant from, Instant to) {
        if (!to.isAfter(from) || Duration.between(from, to).compareTo(MAX_RANGE) > 0) {
            throw new BusinessRuleException("schedule.range-invalid", "The period must be up to 62 days long");
        }
        return merge(busy(from, to, lesson -> !lesson.expectedIds().contains(studentId)));
    }

    /**
     * Checks that the teacher is free in {@code [from, to)}, not counting the lesson being moved.
     *
     * @throws ConflictException {@code schedule.slot-busy} if another lesson, the off time or the
     *                           teacher's calendar takes the time
     */
    @Transactional(readOnly = true)
    public void requireFree(Instant from, Instant to, UUID movedLesson) {
        if (!isFree(from, to, movedLesson)) {
            throw new ConflictException("schedule.slot-busy", "The teacher is busy at this time");
        }
    }

    /** Whether the teacher is free in {@code [from, to)}, not counting the lesson being moved. */
    @Transactional(readOnly = true)
    public boolean isFree(Instant from, Instant to, @Nullable UUID movedLesson) {
        return busy(from, to, lesson -> !lesson.id().equals(movedLesson)).isEmpty();
    }

    private List<BusyTime> busy(Instant from, Instant to, Predicate<Lesson> counted) {
        List<BusyTime> busy = new ArrayList<>();
        for (Lesson lesson : lessons.findOverlapping(from, to)) {
            if (counted.test(lesson)) {
                busy.add(new BusyTime(lesson.startsAt(), lesson.endsAt()));
            }
        }
        busy.addAll(offTime.busy(from, to));
        ExternalBusyTimes calendar = external.getIfAvailable();
        if (calendar != null) {
            calendar.busy(from, to).stream()
                    .filter(time -> time.start().isBefore(to) && time.end().isAfter(from))
                    .forEach(busy::add);
        }
        return busy;
    }

    /** Sorted periods with the overlapping and adjacent ones joined. */
    static List<BusyTime> merge(List<BusyTime> times) {
        List<BusyTime> sorted = times.stream().sorted(Comparator.comparing(BusyTime::start)).toList();
        List<BusyTime> merged = new ArrayList<>();
        for (BusyTime time : sorted) {
            if (!merged.isEmpty() && !time.start().isAfter(merged.getLast().end())) {
                BusyTime last = merged.removeLast();
                merged.add(new BusyTime(last.start(), time.end().isAfter(last.end()) ? time.end() : last.end()));
            } else {
                merged.add(time);
            }
        }
        return List.copyOf(merged);
    }
}

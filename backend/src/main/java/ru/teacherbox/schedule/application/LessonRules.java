package ru.teacherbox.schedule.application;

import java.time.Duration;
import java.time.LocalTime;
import java.util.List;

/**
 * The teacher's lesson rules (ADR-0056), stored in {@code schedule.settings}; a value not set yet is the
 * default.
 *
 * @param defaultDurationMinutes lesson duration when none is given
 * @param lateCancellation       a student's cancellation later than this before the lesson is late: the teacher
 *                               decides whether to charge it
 * @param reminders              how long before a lesson reminders are sent, shortest first; empty: none
 * @param horizon                how far ahead lessons of a series are created
 * @param workStart              the start of the teacher's working hours of every day, the teacher's zone
 * @param workEnd                their end, after {@code workStart}: free times to move a lesson fit in them, the
 *                               calendar shows them
 */
public record LessonRules(int defaultDurationMinutes, Duration lateCancellation, List<Duration> reminders,
        Duration horizon, LocalTime workStart, LocalTime workEnd) {

    public static final int DEFAULT_DURATION = 60;
    public static final Duration DEFAULT_LATE_CANCELLATION = Duration.ofHours(24);
    public static final List<Duration> DEFAULT_REMINDERS = List.of(Duration.ofHours(1), Duration.ofHours(24));
    public static final Duration DEFAULT_HORIZON = Duration.ofDays(84);
    public static final LocalTime DEFAULT_WORK_START = LocalTime.of(8, 0);
    public static final LocalTime DEFAULT_WORK_END = LocalTime.of(21, 0);

    public LessonRules {
        reminders = reminders.stream().distinct().sorted().toList();
    }

    /** Whole days of the horizon. */
    public long horizonDays() {
        return horizon.toDays();
    }
}

package ru.teacherbox.schedule.application;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings of the schedule module ({@code TEACHERBOX_SCHEDULE_*}).
 *
 * @param defaultDuration  lesson duration in minutes when none is given
 * @param horizon          how far ahead lessons of a series are created
 * @param lateCancellation a student's cancellation later than this before the lesson is late: the
 *                         teacher decides whether to charge it
 * @param reminders        how long before a lesson reminders are sent, e.g. {@code 24h,1h}; empty = none
 */
@ConfigurationProperties("teacherbox.schedule")
public record ScheduleProperties(
        @DefaultValue("60") int defaultDuration,
        @DefaultValue("84d") Duration horizon,
        @DefaultValue("24h") Duration lateCancellation,
        @DefaultValue({"24h", "1h"}) List<Duration> reminders) {

    public ScheduleProperties {
        if (defaultDuration < 1 || defaultDuration > 600) {
            throw new IllegalArgumentException("TEACHERBOX_SCHEDULE_DEFAULT_DURATION must be 1-600 minutes");
        }
        if (horizon.compareTo(Duration.ofDays(7)) < 0) {
            throw new IllegalArgumentException("TEACHERBOX_SCHEDULE_HORIZON must be at least 7 days");
        }
        if (reminders.stream().anyMatch(reminder -> reminder.isNegative() || reminder.isZero())) {
            throw new IllegalArgumentException("TEACHERBOX_SCHEDULE_REMINDERS must be positive durations");
        }
        reminders = reminders.stream().distinct().sorted().toList();
    }

    /** Whole days of the horizon. */
    public long horizonDays() {
        return horizon.toDays();
    }
}

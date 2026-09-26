package ru.teacherbox.schedule.api;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Regular lessons were planned, e.g. every Tuesday and Thursday at 18:00.
 *
 * @param groupId       the group of a group series, {@code null} for a series with one student
 * @param studentIds    students of the series (the members of the group when it was planned)
 * @param startTime     local time in the instance time zone
 * @param intervalWeeks 1 = every week, 2 = every other week, ...
 */
public record SeriesScheduled(
        UUID seriesId,
        @Nullable UUID groupId,
        List<UUID> studentIds,
        List<DayOfWeek> weekdays,
        LocalTime startTime,
        int durationMinutes,
        int intervalWeeks,
        LocalDate startsOn,
        @Nullable LocalDate endsOn,
        Instant occurredAt) {

    public SeriesScheduled {
        studentIds = List.copyOf(studentIds);
        weekdays = List.copyOf(weekdays);
    }
}

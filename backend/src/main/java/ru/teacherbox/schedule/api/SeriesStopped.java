package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Regular lessons end: the lessons of the series from {@code from} on are removed.
 *
 * @param groupId    the group of a group series, {@code null} for a series with one student
 * @param studentIds students of the series (the current members of the group)
 * @param replaced   {@code true} if the series continues with new settings ({@link SeriesScheduled} follows)
 */
public record SeriesStopped(UUID seriesId, @Nullable UUID groupId, List<UUID> studentIds, LocalDate from,
        boolean replaced, Instant occurredAt) {

    public SeriesStopped {
        studentIds = List.copyOf(studentIds);
    }
}

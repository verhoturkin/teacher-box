package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Regular lessons end: the lessons of the series from {@code from} on are removed.
 *
 * @param replaced {@code true} if the series continues with new settings ({@link SeriesScheduled} follows)
 */
public record SeriesStopped(UUID seriesId, UUID studentId, LocalDate from, boolean replaced, Instant occurredAt) {
}

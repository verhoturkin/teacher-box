package ru.teacherbox.schedule;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Distinct lesson times for tests that share one database: every call returns a start at least two
 * hours after (or before) the previous one, so lessons of different tests never overlap, even when a
 * test moves the clock by an odd amount. Future slots start two days ahead of the clock.
 *
 * <p>Series tests plan weekly lessons two weeks ahead and further, for the whole horizon, at fixed
 * hours in Moscow (see {@link #SERIES_HOURS}). Future slots march on by two hours with every call of
 * every test, so they reach those days, and a check of the teacher's time (a new lesson, a moved one)
 * would find a slot busy, depending on the hour the build runs. A future slot therefore takes its two
 * hours outside the hours of series tests on any day.
 */
public final class Slots {

    private static final Duration GAP = Duration.ofHours(2);
    /**
     * The hours (UTC) of the weekly lessons of series tests, with room for lessons of 90 minutes:
     * 05:00–08:30, 09:30–11:00, 13:00–18:30 and 20:30–22:00 in Moscow (SeriesIntegrationTests,
     * GroupLessonsIntegrationTests, GoogleCalendarIntegrationTests).
     */
    static final List<Hours> SERIES_HOURS = List.of(
            new Hours(LocalTime.of(2, 0), LocalTime.of(5, 30)),
            new Hours(LocalTime.of(6, 30), LocalTime.of(8, 0)),
            new Hours(LocalTime.of(10, 0), LocalTime.of(15, 30)),
            new Hours(LocalTime.of(17, 30), LocalTime.of(19, 0)));
    private static final AtomicReference<Instant> LAST_NEXT = new AtomicReference<>(Instant.MIN);
    private static final AtomicReference<Instant> LAST_PAST = new AtomicReference<>(Instant.MAX);

    private Slots() {
    }

    /** A lesson that has already taken place (a month back and earlier). */
    public static Instant past(Clock clock) {
        Instant candidate = clock.instant().truncatedTo(ChronoUnit.HOURS).minus(Duration.ofDays(30));
        return LAST_PAST.updateAndGet(last -> {
            Instant before = last.equals(Instant.MAX) ? candidate : last.minus(GAP);
            return candidate.isBefore(before) ? candidate : before;
        });
    }

    /** A start at least two days ahead of the clock. */
    public static Instant next(Clock clock) {
        Instant candidate = clock.instant().truncatedTo(ChronoUnit.HOURS).plus(Duration.ofDays(2));
        return LAST_NEXT.updateAndGet(last -> {
            Instant after = last.equals(Instant.MIN) ? candidate : last.plus(GAP);
            return awayFromSeries(candidate.isAfter(after) ? candidate : after);
        });
    }

    /** The slot, or the first start after it whose two hours miss the hours of series tests. */
    static Instant awayFromSeries(Instant slot) {
        Instant free = slot;
        boolean moved = true;
        while (moved) {
            moved = false;
            Instant day = free.truncatedTo(ChronoUnit.DAYS);
            for (Instant midnight : List.of(day.minus(Duration.ofDays(1)), day, day.plus(Duration.ofDays(1)))) {
                for (Hours hours : SERIES_HOURS) {
                    Instant from = midnight.plus(Duration.between(LocalTime.MIDNIGHT, hours.from()));
                    Instant to = midnight.plus(Duration.between(LocalTime.MIDNIGHT, hours.to()));
                    if (free.isBefore(to) && free.plus(GAP).isAfter(from)) {
                        free = to;
                        moved = true;
                    }
                }
            }
        }
        return free;
    }

    /** Hours of a day in UTC. */
    record Hours(LocalTime from, LocalTime to) {
    }
}

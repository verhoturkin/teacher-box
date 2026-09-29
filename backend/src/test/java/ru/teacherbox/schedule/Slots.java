package ru.teacherbox.schedule;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Distinct lesson times for tests that share one database: every call returns a start at least two
 * hours after (or before) the previous one, so lessons of different tests never overlap, even when a
 * test moves the clock by an odd amount. Future slots start two days ahead of the clock; series tests
 * use later days.
 *
 * <p>Series tests plan weekly lessons early in the morning (05:00–07:15 in Moscow, 02:00–05:15 UTC).
 * Future slots march on by two hours with every call of every test, so they would reach those hours on
 * some days and a check of the teacher's time would find them busy, depending on the hour the build
 * runs. Future slots therefore never start between 00:00 and 06:00 UTC.
 */
public final class Slots {

    private static final Duration GAP = Duration.ofHours(2);
    /** Future slots start at this hour (UTC) or later: the hours before belong to series tests. */
    private static final int FIRST_HOUR = 6;
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

    /** The slot, or 06:00 UTC of its day when it would start in the hours of series tests. */
    static Instant awayFromSeries(Instant slot) {
        int hour = slot.atZone(ZoneOffset.UTC).getHour();
        return hour < FIRST_HOUR ? slot.truncatedTo(ChronoUnit.DAYS).plus(Duration.ofHours(FIRST_HOUR)) : slot;
    }
}

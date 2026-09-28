package ru.teacherbox.schedule;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Distinct lesson times for tests that share one database: every call returns a start at least two
 * hours after (or before) the previous one, so lessons of different tests never overlap, even when a
 * test moves the clock by an odd amount. Future slots start two days ahead of the clock; series tests
 * use later days.
 */
public final class Slots {

    private static final Duration GAP = Duration.ofHours(2);
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
            return candidate.isAfter(after) ? candidate : after;
        });
    }
}

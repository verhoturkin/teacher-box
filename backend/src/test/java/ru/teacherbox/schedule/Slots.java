package ru.teacherbox.schedule;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Distinct lesson times for tests that share one database: every call returns a start two hours
 * after (or before) the previous one, so lessons of different tests never overlap. Future slots stay
 * within the first two weeks; series tests use later days.
 */
public final class Slots {

    private static final AtomicInteger NEXT = new AtomicInteger();

    private Slots() {
    }

    /** A lesson that has already taken place (a month back and earlier). */
    public static Instant past(Clock clock) {
        return clock.instant().truncatedTo(ChronoUnit.HOURS)
                .minus(Duration.ofDays(30))
                .minus(Duration.ofHours(2L * NEXT.incrementAndGet()));
    }

    /** A start at least two days ahead of the clock. */
    public static Instant next(Clock clock) {
        return clock.instant().truncatedTo(ChronoUnit.HOURS)
                .plus(Duration.ofDays(2))
                .plus(Duration.ofHours(2L * NEXT.incrementAndGet()));
    }
}

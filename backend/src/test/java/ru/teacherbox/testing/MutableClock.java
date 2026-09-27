package ru.teacherbox.testing;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

/** Test clock that can be moved forward. */
public final class MutableClock extends Clock {

    private Instant now;

    public MutableClock(Instant start) {
        this.now = start;
    }

    /** Current time truncated to microseconds, the precision of database timestamps. */
    public static MutableClock startingNow() {
        return new MutableClock(Instant.now().truncatedTo(ChronoUnit.MICROS));
    }

    public void advance(Duration duration) {
        now = now.plus(duration);
    }

    @Override
    public Instant instant() {
        return now;
    }

    @Override
    public ZoneId getZone() {
        return ZoneOffset.UTC;
    }

    /** The same moving time seen in another zone (e.g. the instance time zone for «today»). */
    @Override
    public Clock withZone(ZoneId zone) {
        MutableClock owner = this;
        return new Clock() {
            @Override
            public ZoneId getZone() {
                return zone;
            }

            @Override
            public Clock withZone(ZoneId other) {
                return owner.withZone(other);
            }

            @Override
            public Instant instant() {
                return owner.instant();
            }
        };
    }
}

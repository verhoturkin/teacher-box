package ru.teacherbox.shared.time;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Time zone of the teacher (the whole instance), a setting of the teacher kept by {@code platform}
 * (ADR-0056). Calendar dates such as lesson dates and report months are interpreted in this zone; instants
 * are stored in UTC, so a change shifts none of them. The teacher may change it at any time: read
 * {@link #zoneId()} on every use, never keep it in a field.
 */
public final class InstanceTimeZone {

    /** The variable the zone was set by before ADR-0056, the name in {@code SettingsChanged}. */
    public static final String SETTING = "TEACHERBOX_TIMEZONE";

    private final Supplier<ZoneId> source;

    /** A zone that never changes (tests, tools). */
    public InstanceTimeZone(ZoneId zoneId) {
        Objects.requireNonNull(zoneId, "zoneId");
        this.source = () -> zoneId;
    }

    /** @param source read on every call */
    public InstanceTimeZone(Supplier<ZoneId> source) {
        this.source = Objects.requireNonNull(source, "source");
    }

    /** The zone in force now. */
    public ZoneId zoneId() {
        return source.get();
    }

    public LocalDate today(Clock clock) {
        return LocalDate.now(clock.withZone(zoneId()));
    }

    @Override
    public String toString() {
        return "InstanceTimeZone[" + zoneId() + "]";
    }
}

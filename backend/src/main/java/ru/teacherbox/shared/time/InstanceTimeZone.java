package ru.teacherbox.shared.time;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;

/**
 * Time zone of the teacher (the whole instance), {@code TEACHERBOX_TIMEZONE}. Calendar dates such as
 * lesson dates and report months are interpreted in this zone; instants are stored in UTC.
 */
public record InstanceTimeZone(ZoneId zoneId) {

    public InstanceTimeZone {
        Objects.requireNonNull(zoneId, "zoneId");
    }

    public LocalDate today(Clock clock) {
        return LocalDate.now(clock.withZone(zoneId));
    }
}

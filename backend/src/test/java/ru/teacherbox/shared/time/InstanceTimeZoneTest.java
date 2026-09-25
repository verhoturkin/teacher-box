package ru.teacherbox.shared.time;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class InstanceTimeZoneTest {

    @Test
    void todayIsTheDateInTheTeachersZone() {
        Clock lateEveningUtc = Clock.fixed(Instant.parse("2026-09-01T22:30:00Z"), ZoneOffset.UTC);

        assertThat(new InstanceTimeZone(ZoneId.of("Europe/Moscow")).today(lateEveningUtc))
                .isEqualTo(LocalDate.parse("2026-09-02"));
        assertThat(new InstanceTimeZone(ZoneOffset.UTC).today(lateEveningUtc))
                .isEqualTo(LocalDate.parse("2026-09-01"));
    }
}

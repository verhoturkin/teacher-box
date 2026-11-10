package ru.teacherbox.shared.time;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;
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

    @Test
    void readsTheZoneOnEveryCall() {
        AtomicReference<ZoneId> stored = new AtomicReference<>(ZoneOffset.UTC);
        InstanceTimeZone zone = new InstanceTimeZone(stored::get);
        assertThat(zone.zoneId()).isEqualTo(ZoneOffset.UTC);
        stored.set(ZoneId.of("Asia/Tokyo"));
        assertThat(zone.zoneId()).isEqualTo(ZoneId.of("Asia/Tokyo"));
        assertThat(zone).hasToString("InstanceTimeZone[Asia/Tokyo]");
    }

    @Test
    void namesTheCronVariableOfAJob() {
        assertThat(ZonedJob.of("boards", "teacherbox.boards.backup-cron", "0 0 3 * * *", () -> { }).cronSetting())
                .isEqualTo("TEACHERBOX_BOARDS_BACKUP_CRON");
    }
}

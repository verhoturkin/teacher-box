package ru.teacherbox.notifications.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DeliveryScheduleTest {

    private static final Instant NOW = Instant.parse("2026-10-01T20:30:00Z");

    @Test
    void waitsUntilTheQuietHoursEnd() {
        Instant morning = Instant.parse("2026-10-02T05:00:00Z");

        Delivery delayed = Delivery.schedule(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                ChannelType.TELEGRAM, "42", "text", NOW, morning);
        Delivery now = Delivery.schedule(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                ChannelType.TELEGRAM, "42", "text", NOW, NOW.minusSeconds(60));

        assertThat(delayed.nextAttemptAt()).isEqualTo(morning);
        assertThat(delayed.createdAt()).isEqualTo(NOW);
        assertThat(now.nextAttemptAt()).isEqualTo(NOW);
    }
}

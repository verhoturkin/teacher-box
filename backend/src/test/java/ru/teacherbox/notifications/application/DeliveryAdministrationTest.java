package ru.teacherbox.notifications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.Delivery;
import ru.teacherbox.notifications.domain.DeliveryStatus;
import ru.teacherbox.notifications.persistence.DeliveryRepository;

class DeliveryAdministrationTest {

    private static final Instant NOW = Instant.parse("2026-10-01T10:00:00Z");

    private final DeliveryRepository repository = mock(DeliveryRepository.class);
    private final DeliveryAdministration administration =
            new DeliveryAdministration(repository, Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void retriesAllTheLatestFailedDeliveries() {
        Delivery first = failed();
        Delivery second = failed();
        when(repository.findFailed(DeliveryAdministration.LIMIT)).thenReturn(List.of(first, second));

        assertThat(administration.retry(Set.of())).isEqualTo(2);

        verify(repository).update(first);
        verify(repository).update(second);
        assertThat(first.status()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(first.nextAttemptAt()).isEqualTo(NOW);
        assertThat(administration.failed()).hasSize(2);
    }

    @Test
    void onlyFailedDeliveriesCanBeRetried() {
        Delivery pending = Delivery.schedule(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                ChannelType.TELEGRAM, "1", "text", NOW);

        assertThatThrownBy(() -> pending.retry(NOW)).isInstanceOf(IllegalStateException.class);
    }

    private static Delivery failed() {
        Delivery delivery = Delivery.schedule(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                ChannelType.TELEGRAM, "1", "text", NOW);
        delivery.abandon("blocked");
        return delivery;
    }
}

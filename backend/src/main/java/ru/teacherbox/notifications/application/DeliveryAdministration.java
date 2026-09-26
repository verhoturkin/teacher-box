package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.Delivery;
import ru.teacherbox.notifications.persistence.DeliveryRepository;

/**
 * Failed deliveries for the administrator (ADR-0010): identifiers and errors only, without the texts of
 * the messages and the names of the recipients.
 */
@Service
public class DeliveryAdministration {

    static final int LIMIT = 200;

    /** A given up delivery without its text. */
    public record FailedDeliveryView(UUID id, UUID recipientId, ChannelType channel, int attempts,
            @Nullable String error, Instant createdAt) {

        static FailedDeliveryView of(Delivery delivery) {
            return new FailedDeliveryView(delivery.id(), delivery.recipientId(), delivery.channel(),
                    delivery.attempts(), delivery.lastError(), delivery.createdAt());
        }
    }

    private final DeliveryRepository deliveries;
    private final Clock clock;

    public DeliveryAdministration(DeliveryRepository deliveries, Clock clock) {
        this.deliveries = deliveries;
        this.clock = clock;
    }

    /** The latest failed deliveries, newest first. */
    @Transactional(readOnly = true)
    public List<FailedDeliveryView> failed() {
        return deliveries.findFailed(LIMIT).stream().map(FailedDeliveryView::of).toList();
    }

    /**
     * Sends failed deliveries again (the given ones, or all the latest ones when {@code ids} is empty).
     *
     * @return number of deliveries scheduled again
     */
    @Transactional
    public int retry(Set<UUID> ids) {
        Instant now = clock.instant();
        List<Delivery> chosen = deliveries.findFailed(LIMIT).stream()
                .filter(delivery -> ids.isEmpty() || ids.contains(delivery.id()))
                .toList();
        chosen.forEach(delivery -> {
            delivery.retry(now);
            deliveries.update(delivery);
        });
        return chosen.size();
    }
}

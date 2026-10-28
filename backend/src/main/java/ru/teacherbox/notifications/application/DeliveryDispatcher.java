package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import ru.teacherbox.notifications.domain.Delivery;
import ru.teacherbox.notifications.domain.DeliveryStatus;
import ru.teacherbox.notifications.persistence.DeliveryRepository;

/**
 * Sends pending deliveries to messengers and browsers (web push) (the outbox). Every delivery is saved right after its attempt;
 * no transaction is held open while a messenger API is called.
 */
@Component
public class DeliveryDispatcher {

    static final int BATCH_SIZE = 50;
    static final String NOT_CONFIGURED = "Messenger is not configured";
    private static final Logger log = LoggerFactory.getLogger(DeliveryDispatcher.class);

    private final DeliveryRepository deliveries;
    private final MessengerChannels channels;
    private final NotificationsProperties properties;
    private final KeyboardCodec keyboards;
    private final PushChannel push;
    private final Clock clock;

    public DeliveryDispatcher(DeliveryRepository deliveries, MessengerChannels channels,
            NotificationsProperties properties, KeyboardCodec keyboards, PushChannel push, Clock clock) {
        this.deliveries = deliveries;
        this.channels = channels;
        this.properties = properties;
        this.keyboards = keyboards;
        this.push = push;
        this.clock = clock;
    }

    /** @return number of messages sent */
    @Scheduled(fixedDelayString = "${teacherbox.notifications.dispatch-interval:PT5S}", initialDelayString = "PT10S")
    public int dispatch() {
        int sent = 0;
        for (Delivery delivery : deliveries.findDue(clock.instant(), BATCH_SIZE)) {
            attempt(delivery);
            deliveries.update(delivery);
            if (delivery.status() == DeliveryStatus.SENT) {
                sent++;
            }
        }
        return sent;
    }

    private void attempt(Delivery delivery) {
        Optional<MessengerChannel> channel = channels.find(delivery.channel());
        if (channel.isEmpty() && delivery.channel().isMessenger()) {
            delivery.abandon(NOT_CONFIGURED);
            return;
        }
        try {
            if (delivery.channel().isMessenger()) {
                send(channel.get(), delivery.externalId(),
                        new OutgoingMessage(delivery.text(), keyboards.read(delivery.keyboard())));
            } else {
                push.send(delivery);
            }
            delivery.markSent(clock.instant());
        } catch (DeliveryException e) {
            log.warn("Delivery {} to {} failed: {}", delivery.id(), delivery.channel(), e.getMessage());
            if (e.isPermanent()) {
                delivery.abandon(String.valueOf(e.getMessage()));
            } else {
                delivery.markFailed(String.valueOf(e.getMessage()), properties.maxAttempts(), clock.instant());
            }
        } catch (RuntimeException e) {
            log.warn("Delivery {} to {} failed", delivery.id(), delivery.channel(), e);
            delivery.markFailed(e.getClass().getSimpleName(), properties.maxAttempts(), clock.instant());
        }
    }

    /**
     * A message refused for its link buttons (Telegram takes no portal on a local address) goes again with the
     * links in the text: «Открыть: https://…».
     */
    private static void send(MessengerChannel channel, String externalId, OutgoingMessage message) {
        try {
            channel.send(externalId, message);
        } catch (DeliveryException e) {
            if (!e.isPermanent() || !message.hasLinks()) {
                throw e;
            }
            log.info("{} refused link buttons, sending the links as text: {}", channel.type(), e.getMessage());
            channel.send(externalId, message.linksInText());
        }
    }
}

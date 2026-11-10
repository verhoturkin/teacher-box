package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.Delivery;
import ru.teacherbox.notifications.domain.DeliveryStatus;
import ru.teacherbox.notifications.persistence.DeliveryRepository;
import ru.teacherbox.shared.settings.LiveProperties;

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
    /** Read on every use: the administrator changes the attempts without a restart (ADR-0056). */
    private final LiveProperties<NotificationsProperties> properties;
    private final KeyboardCodec keyboards;
    private final PushChannel push;
    private final Clock clock;

    public DeliveryDispatcher(DeliveryRepository deliveries, MessengerChannels channels,
            Environment environment, KeyboardCodec keyboards, PushChannel push, Clock clock) {
        this.deliveries = deliveries;
        this.channels = channels;
        this.properties = new LiveProperties<>(environment, NotificationsProperties.class);
        this.keyboards = keyboards;
        this.push = push;
        this.clock = clock;
    }

    /** @return number of messages sent */
    @Scheduled(fixedDelayString = "${teacherbox.notifications.dispatch-interval:PT5S}", initialDelayString = "PT10S")
    public int dispatch() {
        int sent = 0;
        // after a temporary failure the rest of the messenger's batch waits for the next run: a hung API would
        // otherwise cost a full read timeout per delivery
        Set<ChannelType> unavailable = EnumSet.noneOf(ChannelType.class);
        for (Delivery delivery : deliveries.findDue(clock.instant(), BATCH_SIZE)) {
            if (unavailable.contains(delivery.channel())) {
                continue;
            }
            if (!attempt(delivery) && delivery.channel().isMessenger()) {
                unavailable.add(delivery.channel());
            }
            deliveries.update(delivery);
            if (delivery.status() == DeliveryStatus.SENT) {
                sent++;
            }
        }
        return sent;
    }

    /** @return {@code false} after a temporary failure (the delivery will be retried) */
    private boolean attempt(Delivery delivery) {
        Optional<MessengerChannel> channel = channels.find(delivery.channel());
        if (channel.isEmpty() && delivery.channel().isMessenger()) {
            delivery.abandon(NOT_CONFIGURED);
            return true;
        }
        try {
            if (delivery.channel().isMessenger()) {
                send(channel.get(), delivery.externalId(),
                        new OutgoingMessage(delivery.text(), keyboards.read(delivery.keyboard())));
            } else {
                push.send(delivery);
            }
            delivery.markSent(clock.instant());
            return true;
        } catch (DeliveryException e) {
            log.warn("Delivery {} to {} failed: {}", delivery.id(), delivery.channel(), e.getMessage());
            if (e.isPermanent()) {
                delivery.abandon(String.valueOf(e.getMessage()));
                return true;
            }
            delivery.markFailed(String.valueOf(e.getMessage()), properties.get().maxAttempts(), clock.instant());
            return false;
        } catch (RuntimeException e) {
            log.warn("Delivery {} to {} failed", delivery.id(), delivery.channel(), e);
            delivery.markFailed(e.getClass().getSimpleName(), properties.get().maxAttempts(), clock.instant());
            return false;
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

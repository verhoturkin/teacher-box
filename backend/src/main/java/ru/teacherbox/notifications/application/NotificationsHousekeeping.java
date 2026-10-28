package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import ru.teacherbox.notifications.persistence.ChatRepository;
import ru.teacherbox.notifications.persistence.DeliveryRepository;
import ru.teacherbox.notifications.persistence.PushSubscriptionRepository;

/**
 * Nightly removal of old finished deliveries, expired buttons and dialogs of the bots and web push devices that
 * stopped answering (the inbox is kept).
 */
@Component
public class NotificationsHousekeeping {

    static final Duration DELIVERY_RETENTION = Duration.ofDays(90);
    /** A chat's dialog (and the account chosen in it) is forgotten after this idle time. */
    static final Duration DIALOG_RETENTION = Duration.ofDays(90);
    /** A device whose messages keep failing and that has not taken one for this long is forgotten. */
    static final Duration PUSH_RETENTION = Duration.ofDays(30);
    private static final Logger log = LoggerFactory.getLogger(NotificationsHousekeeping.class);

    private final DeliveryRepository deliveries;
    private final ChatRepository chat;
    private final PushSubscriptionRepository pushSubscriptions;
    private final Clock clock;

    public NotificationsHousekeeping(DeliveryRepository deliveries, ChatRepository chat,
            PushSubscriptionRepository pushSubscriptions, Clock clock) {
        this.deliveries = deliveries;
        this.chat = chat;
        this.pushSubscriptions = pushSubscriptions;
        this.clock = clock;
    }

    @Scheduled(cron = "${teacherbox.notifications.housekeeping-cron:0 20 4 * * *}",
            zone = "${teacherbox.timezone:Europe/Moscow}")
    void run() {
        purge(clock.instant());
    }

    /** @return number of removed deliveries */
    public int purge(Instant now) {
        int removed = deliveries.deleteFinishedBefore(now.minus(DELIVERY_RETENTION));
        if (removed > 0) {
            log.info("Housekeeping: removed {} old deliveries", removed);
        }
        int expired = chat.deleteExpired(now, now.minus(DIALOG_RETENTION));
        if (expired > 0) {
            log.info("Housekeeping: removed {} expired buttons and dialogs of the bots", expired);
        }
        int stale = pushSubscriptions.deleteStale(now.minus(PUSH_RETENTION));
        if (stale > 0) {
            log.info("Housekeeping: removed {} stale web push devices", stale);
        }
        return removed;
    }
}

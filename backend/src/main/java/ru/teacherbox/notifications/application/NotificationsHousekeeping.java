package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import ru.teacherbox.notifications.persistence.DeliveryRepository;

/** Nightly removal of old finished deliveries (the inbox itself is kept). */
@Component
public class NotificationsHousekeeping {

    static final Duration DELIVERY_RETENTION = Duration.ofDays(90);
    private static final Logger log = LoggerFactory.getLogger(NotificationsHousekeeping.class);

    private final DeliveryRepository deliveries;
    private final Clock clock;

    public NotificationsHousekeeping(DeliveryRepository deliveries, Clock clock) {
        this.deliveries = deliveries;
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
        return removed;
    }
}

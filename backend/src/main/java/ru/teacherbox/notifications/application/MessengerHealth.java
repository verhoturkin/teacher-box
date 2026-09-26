package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import ru.teacherbox.notifications.application.NotificationViews.Connection;
import ru.teacherbox.notifications.application.NotificationViews.MessengerStatus;
import ru.teacherbox.notifications.domain.ChannelType;

/**
 * Whether the messenger APIs can be reached, judged by the latest long polling request. Shown to the
 * teacher so that a blocked API or a broken proxy is visible without reading the logs.
 */
@Component
public class MessengerHealth {

    private final Map<ChannelType, MessengerStatus> statuses = new ConcurrentHashMap<>();
    private final Clock clock;

    public MessengerHealth(Clock clock) {
        this.clock = clock;
    }

    /** @return {@code true} if the messenger was not reachable before */
    boolean succeeded(ChannelType channel) {
        MessengerStatus previous = statuses.put(channel,
                new MessengerStatus(channel, Connection.OK, null, clock.instant()));
        return previous == null || previous.connection() != Connection.OK;
    }

    void failed(ChannelType channel, String error) {
        statuses.put(channel, new MessengerStatus(channel, Connection.ERROR, error, clock.instant()));
    }

    /** Forgets the state after the messenger was configured again. */
    public void reset(ChannelType channel) {
        statuses.remove(channel);
    }

    public MessengerStatus status(ChannelType channel) {
        return statuses.getOrDefault(channel, new MessengerStatus(channel, Connection.PENDING, null, null));
    }
}

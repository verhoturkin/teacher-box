package ru.teacherbox.notifications.application;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;
import ru.teacherbox.notifications.domain.ChannelType;

/**
 * Receives messages to the bots: one virtual thread per configured messenger runs long polling. A
 * messenger configured again in the settings page gets a new thread. Disabled together with
 * scheduled jobs ({@code teacherbox.scheduling.enabled=false}, e.g. in tests).
 */
@Component
@ConditionalOnBooleanProperty(name = "teacherbox.scheduling.enabled", matchIfMissing = true)
public class MessengerPolling implements SmartLifecycle {

    static final Duration MIN_BACKOFF = Duration.ofSeconds(1);
    static final Duration MAX_BACKOFF = Duration.ofMinutes(1);
    private static final Logger log = LoggerFactory.getLogger(MessengerPolling.class);

    private final MessengerChannels channels;
    private final ChatEngine engine;
    private final MessengerHealth health;
    private final Map<ChannelType, Thread> threads = new ConcurrentHashMap<>();
    private volatile boolean running;

    public MessengerPolling(MessengerChannels channels, ChatEngine engine, MessengerHealth health) {
        this.channels = channels;
        this.engine = engine;
        this.health = health;
    }

    @Override
    public synchronized void start() {
        running = true;
        channels.all().forEach(this::startPolling);
    }

    @Override
    public synchronized void stop() {
        running = false;
        threads.values().forEach(Thread::interrupt);
        threads.clear();
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    /** Stops polling the messenger and starts again with its current adapter, if there is one. */
    public synchronized void restart(ChannelType type) {
        if (!running) {
            return;
        }
        Thread previous = threads.remove(type);
        if (previous != null) {
            previous.interrupt();
        }
        channels.find(type).ifPresent(this::startPolling);
    }

    /**
     * Receives one batch of messages and pressed buttons and answers them.
     *
     * @return number of handled messages
     */
    int pollOnce(MessengerChannel channel) {
        List<IncomingMessage> messages = channel.poll();
        for (IncomingMessage message : messages) {
            ButtonPress press = message.press();
            if (press != null) {
                acknowledge(channel, message.externalId(), press);
            }
            OutgoingMessage reply = engine.handle(channel.type(), message);
            try {
                channel.send(message.externalId(), reply);
            } catch (DeliveryException e) {
                log.warn("Could not reply in {}: {}", channel.type(), e.getMessage());
            }
        }
        return messages.size();
    }

    private static void acknowledge(MessengerChannel channel, String externalId, ButtonPress press) {
        try {
            channel.acknowledge(externalId, press);
        } catch (RuntimeException e) {
            log.debug("Could not acknowledge a button in {}: {}", channel.type(), e.getMessage());
        }
    }

    /** Shows the bot's commands in the messenger's menu. */
    static void publishCommands(MessengerChannel channel) {
        try {
            channel.publishCommands(ChatEngine.COMMANDS);
        } catch (RuntimeException e) {
            log.warn("Could not publish the bot's commands to {}: {}", channel.type(), e.getMessage());
        }
    }

    private void startPolling(MessengerChannel channel) {
        threads.put(channel.type(), Thread.ofVirtual().name("messenger-" + channel.type()).start(() -> loop(channel)));
    }

    private void loop(MessengerChannel channel) {
        publishCommands(channel);
        Duration backoff = MIN_BACKOFF;
        while (active()) {
            try {
                pollOnce(channel);
                if (health.succeeded(channel.type())) {
                    log.info("Receiving messages from {}", channel.type());
                }
                backoff = MIN_BACKOFF;
            } catch (RuntimeException e) {
                if (!active()) {
                    return;
                }
                health.failed(channel.type(), String.valueOf(e.getMessage()));
                log.warn("Polling {} failed, retrying in {} s: {}", channel.type(), backoff.toSeconds(), e.getMessage());
                if (!pause(backoff)) {
                    return;
                }
                backoff = nextBackoff(backoff);
            }
        }
    }

    /** The service runs and this polling thread has not been replaced. */
    private boolean active() {
        return running && !Thread.currentThread().isInterrupted();
    }

    static Duration nextBackoff(Duration current) {
        Duration doubled = current.multipliedBy(2);
        return doubled.compareTo(MAX_BACKOFF) > 0 ? MAX_BACKOFF : doubled;
    }

    private static boolean pause(Duration duration) {
        try {
            Thread.sleep(duration);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}

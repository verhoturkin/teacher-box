package ru.teacherbox.notifications.application;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

/**
 * Receives messages to the bots: one virtual thread per configured messenger runs long polling.
 * Disabled together with scheduled jobs ({@code teacherbox.scheduling.enabled=false}, e.g. in tests).
 */
@Component
@ConditionalOnBooleanProperty(name = "teacherbox.scheduling.enabled", matchIfMissing = true)
public class MessengerPolling implements SmartLifecycle {

    static final Duration MIN_BACKOFF = Duration.ofSeconds(1);
    static final Duration MAX_BACKOFF = Duration.ofMinutes(1);
    private static final Logger log = LoggerFactory.getLogger(MessengerPolling.class);

    private final MessengerChannels channels;
    private final ChannelService channelService;
    private final List<Thread> threads = new ArrayList<>();
    private volatile boolean running;

    public MessengerPolling(MessengerChannels channels, ChannelService channelService) {
        this.channels = channels;
        this.channelService = channelService;
    }

    @Override
    public synchronized void start() {
        running = true;
        for (MessengerChannel channel : channels.all()) {
            threads.add(Thread.ofVirtual().name("messenger-" + channel.type()).start(() -> loop(channel)));
        }
    }

    @Override
    public synchronized void stop() {
        running = false;
        threads.forEach(Thread::interrupt);
        threads.clear();
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    /**
     * Receives one batch of messages and answers them.
     *
     * @return number of handled messages
     */
    int pollOnce(MessengerChannel channel) {
        List<IncomingMessage> messages = channel.poll();
        for (IncomingMessage message : messages) {
            String reply = channelService.handleIncoming(channel.type(), message);
            try {
                channel.send(message.externalId(), reply);
            } catch (DeliveryException e) {
                log.warn("Could not reply in {}: {}", channel.type(), e.getMessage());
            }
        }
        return messages.size();
    }

    private void loop(MessengerChannel channel) {
        log.info("Receiving messages from {}", channel.type());
        Duration backoff = MIN_BACKOFF;
        while (running) {
            try {
                pollOnce(channel);
                backoff = MIN_BACKOFF;
            } catch (RuntimeException e) {
                if (!running) {
                    return;
                }
                log.warn("Polling {} failed, retrying in {} s: {}", channel.type(), backoff.toSeconds(), e.getMessage());
                if (!pause(backoff)) {
                    return;
                }
                backoff = nextBackoff(backoff);
            }
        }
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

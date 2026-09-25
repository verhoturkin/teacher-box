package ru.teacherbox.notifications;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.notifications.application.DeliveryException;
import ru.teacherbox.notifications.application.IncomingMessage;
import ru.teacherbox.notifications.application.MessengerChannel;
import ru.teacherbox.notifications.domain.ChannelType;

/** In-memory messenger: records sent messages, can be told to fail, returns queued incoming messages. */
public final class FakeMessengerChannel implements MessengerChannel {

    public record Sent(String externalId, String text) {
    }

    private final ChannelType type;
    private final List<Sent> sent = new CopyOnWriteArrayList<>();
    private final List<IncomingMessage> incoming = new CopyOnWriteArrayList<>();
    private volatile @Nullable RuntimeException failure;

    public FakeMessengerChannel(ChannelType type) {
        this.type = type;
    }

    /** Subsequent sends fail with the given error (usually a {@link DeliveryException}) until {@link #reset()}. */
    public void failWith(RuntimeException error) {
        failure = error;
    }

    public void receive(IncomingMessage message) {
        incoming.add(message);
    }

    public List<Sent> sent() {
        return List.copyOf(sent);
    }

    public void reset() {
        sent.clear();
        incoming.clear();
        failure = null;
    }

    @Override
    public ChannelType type() {
        return type;
    }

    @Override
    public Optional<String> chatLink(String code) {
        return Optional.of("https://t.me/test_bot?start=" + code);
    }

    @Override
    public void send(String externalId, String text) {
        RuntimeException error = failure;
        if (error != null) {
            throw error;
        }
        sent.add(new Sent(externalId, text));
    }

    @Override
    public List<IncomingMessage> poll() {
        List<IncomingMessage> batch = new ArrayList<>(incoming);
        incoming.removeAll(batch);
        return batch;
    }
}

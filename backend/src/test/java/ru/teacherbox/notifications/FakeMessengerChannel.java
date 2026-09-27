package ru.teacherbox.notifications;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.notifications.application.BotCommand;
import ru.teacherbox.notifications.application.ButtonPress;
import ru.teacherbox.notifications.application.DeliveryException;
import ru.teacherbox.notifications.application.IncomingMessage;
import ru.teacherbox.notifications.application.MessengerChannel;
import ru.teacherbox.notifications.application.OutgoingButton;
import ru.teacherbox.notifications.application.OutgoingMessage;
import ru.teacherbox.notifications.domain.ChannelType;

/**
 * In-memory messenger: records sent messages with their buttons, acknowledged presses and published
 * commands, can be told to fail, returns queued incoming messages.
 */
public final class FakeMessengerChannel implements MessengerChannel {

    public record Sent(String externalId, String text, List<List<OutgoingButton>> rows) {

        public Sent(String externalId, String text) {
            this(externalId, text, List.of());
        }

        /** Data of the button with the label. */
        public String button(String label) {
            return rows.stream()
                    .flatMap(List::stream)
                    .filter(button -> button.label().equals(label))
                    .map(OutgoingButton::data)
                    .filter(java.util.Objects::nonNull)
                    .findFirst()
                    .orElseThrow(() -> new AssertionError("No button «" + label + "» in " + rows));
        }

        public List<String> labels() {
            return rows.stream().flatMap(List::stream).map(OutgoingButton::label).toList();
        }
    }

    private final ChannelType type;
    private final List<Sent> sent = new CopyOnWriteArrayList<>();
    private final List<IncomingMessage> incoming = new CopyOnWriteArrayList<>();
    private final List<ButtonPress> acknowledged = new CopyOnWriteArrayList<>();
    private final List<BotCommand> commands = new CopyOnWriteArrayList<>();
    private volatile @Nullable RuntimeException failure;
    private volatile @Nullable RuntimeException botNameFailure;

    public FakeMessengerChannel(ChannelType type) {
        this.type = type;
    }

    /** Subsequent sends fail with the given error (usually a {@link DeliveryException}) until {@link #reset()}. */
    public void failWith(RuntimeException error) {
        failure = error;
    }

    /** Asking for the bot's name fails with the given error ({@code null}: it succeeds again). */
    public void failBotName(@Nullable RuntimeException error) {
        botNameFailure = error;
    }

    public void receive(IncomingMessage message) {
        incoming.add(message);
    }

    public List<Sent> sent() {
        return List.copyOf(sent);
    }

    public Sent lastSent() {
        return sent.getLast();
    }

    public List<ButtonPress> acknowledged() {
        return List.copyOf(acknowledged);
    }

    public List<BotCommand> commands() {
        return List.copyOf(commands);
    }

    public void reset() {
        sent.clear();
        acknowledged.clear();
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
    public void send(String externalId, OutgoingMessage message) {
        RuntimeException error = failure;
        if (error != null) {
            throw error;
        }
        sent.add(new Sent(externalId, message.text(), message.rows()));
    }

    @Override
    public void acknowledge(String externalId, ButtonPress press) {
        acknowledged.add(press);
    }

    @Override
    public void publishCommands(List<BotCommand> published) {
        commands.addAll(published);
    }

    @Override
    public String botName() {
        RuntimeException error = botNameFailure;
        if (error != null) {
            throw error;
        }
        return "@test_bot";
    }

    @Override
    public List<IncomingMessage> poll() {
        List<IncomingMessage> batch = new ArrayList<>(incoming);
        incoming.removeAll(batch);
        return batch;
    }
}

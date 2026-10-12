package ru.teacherbox.notifications.application;

import java.util.List;
import java.util.Optional;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.shared.i18n.Language;

/**
 * A messenger adapter (SPI), created by a {@link MessengerChannelFactory} when the messenger is
 * configured. The adapters talk to the messenger APIs directly with long polling, so the instance
 * needs no public webhook address.
 */
public interface MessengerChannel {

    ChannelType type();

    /**
     * Link that opens a chat with the bot. When the messenger supports start parameters, the code
     * is passed along and the account is connected in one tap.
     */
    Optional<String> chatLink(String code);

    /**
     * Sends a message with its buttons.
     *
     * @throws DeliveryException if the messenger did not accept the message
     */
    void send(String externalId, OutgoingMessage message);

    /**
     * Sends a text message.
     *
     * @throws DeliveryException if the messenger did not accept the message
     */
    default void send(String externalId, String text) {
        send(externalId, OutgoingMessage.text(text));
    }

    /** Waits for new messages and pressed buttons (long polling) and returns them. */
    List<IncomingMessage> poll();

    /** Tells the messenger the press was handled (stops the button's spinner); best effort. */
    default void acknowledge(String externalId, ButtonPress press) {
        // nothing to do in messengers where a button sends a message
    }

    /**
     * Shows the bot's commands in the messenger's menu, if it has one; best effort. The messenger shows a
     * user the commands of the language of their app, the Russian ones otherwise.
     */
    default void publishCommands(List<BotCommand> commands, Language language) {
        // the messenger has no menu of commands
    }

    /**
     * The bot's name in the messenger (e.g. {@code @school_bot}); asks the messenger, so it also
     * checks the token.
     *
     * @throws IllegalStateException if the messenger does not accept the settings
     */
    String botName();
}

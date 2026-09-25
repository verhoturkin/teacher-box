package ru.teacherbox.notifications.application;

import java.util.List;
import java.util.Optional;
import ru.teacherbox.notifications.domain.ChannelType;

/**
 * A messenger adapter (SPI). A bean exists only when the messenger is configured; the adapters talk
 * to the messenger APIs directly with long polling, so the instance needs no public webhook address.
 */
public interface MessengerChannel {

    ChannelType type();

    /**
     * Link that opens a chat with the bot. When the messenger supports start parameters, the code
     * is passed along and the account is connected in one tap.
     */
    Optional<String> chatLink(String code);

    /**
     * Sends a text message.
     *
     * @throws DeliveryException if the messenger did not accept the message
     */
    void send(String externalId, String text);

    /** Waits for new messages to the bot (long polling) and returns them. */
    List<IncomingMessage> poll();
}

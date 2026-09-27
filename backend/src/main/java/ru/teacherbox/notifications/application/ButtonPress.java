package ru.teacherbox.notifications.application;

import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * A pressed button of a message of the bot.
 *
 * @param data        what the button carries ({@link OutgoingButton#data()})
 * @param callbackId  id to acknowledge the press with (Telegram callback query, MAX callback)
 * @param messageId   the message with the button, when the messenger tells it (Telegram)
 * @param messageText text of that message, when the messenger tells it (MAX)
 */
public record ButtonPress(String data, @Nullable String callbackId, @Nullable String messageId,
        @Nullable String messageText) {

    public ButtonPress {
        Objects.requireNonNull(data, "data");
    }
}

package ru.teacherbox.notifications.application;

import org.jspecify.annotations.Nullable;

/**
 * A private message to the bot or a pressed button.
 *
 * @param externalId  id to reply to (chat or user id in the messenger)
 * @param displayName how the account is shown to its owner in the portal, e.g. {@code @maria}
 * @param text        message text; a start parameter arrives as {@code /start <payload>}; for a pressed
 *                    button, its label if the messenger sends one
 * @param press       the pressed button, {@code null} for a message
 */
public record IncomingMessage(String externalId, @Nullable String displayName, String text,
        @Nullable ButtonPress press) {

    public IncomingMessage(String externalId, @Nullable String displayName, String text) {
        this(externalId, displayName, text, null);
    }
}

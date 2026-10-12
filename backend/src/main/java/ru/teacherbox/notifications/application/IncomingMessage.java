package ru.teacherbox.notifications.application;

import org.jspecify.annotations.Nullable;

/**
 * A private message to the bot or a pressed button.
 *
 * @param externalId  id to reply to (chat or user id in the messenger)
 * @param displayName how the account is shown to its owner in the portal, e.g. {@code @maria}
 * @param text        message text; a start parameter arrives as {@code /start <payload>}; for a pressed
 *                    button, its label if the messenger sends one; for a file, its caption
 * @param press       the pressed button, {@code null} for a message
 * @param file        a picture or a document sent with the message (ADR-0038), {@code null} if none
 */
public record IncomingMessage(String externalId, @Nullable String displayName, String text,
        @Nullable ButtonPress press, @Nullable IncomingFile file) {

    public IncomingMessage(String externalId, @Nullable String displayName, String text) {
        this(externalId, displayName, text, null, null);
    }

    public IncomingMessage(String externalId, @Nullable String displayName, String text,
            @Nullable ButtonPress press) {
        this(externalId, displayName, text, press, null);
    }
}

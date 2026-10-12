package ru.teacherbox.notifications.application;

import org.jspecify.annotations.Nullable;

/**
 * The video room of a notification: messengers show it as a «Подключиться» button instead of the address in the
 * text.
 *
 * @param url the address of the room
 * @param body the text of the notification in messengers, without the address; {@code null} — no text
 */
record JoinLink(String url, @Nullable String body) {
}

package ru.teacherbox.notifications.application;

import org.jspecify.annotations.Nullable;

/** A notification written for one recipient, in their language; {@code join} — its video room. */
record Message(String title, @Nullable String body, @Nullable JoinLink join) {

    Message(String title, @Nullable String body) {
        this(title, body, null);
    }
}

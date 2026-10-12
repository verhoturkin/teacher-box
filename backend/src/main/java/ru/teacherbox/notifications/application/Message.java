package ru.teacherbox.notifications.application;

import org.jspecify.annotations.Nullable;

/** A notification written for one recipient, in their language. */
record Message(String title, @Nullable String body) {
}

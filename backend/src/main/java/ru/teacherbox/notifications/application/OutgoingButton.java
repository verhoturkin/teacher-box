package ru.teacherbox.notifications.application;

import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * A button of a message in a messenger: {@code data} comes back when it is pressed (at most 64 bytes,
 * the Telegram limit), or {@code url} is opened.
 */
public record OutgoingButton(String label, @Nullable String data, @Nullable String url) {

    public OutgoingButton {
        Objects.requireNonNull(label, "label");
        if ((data == null) == (url == null)) {
            throw new IllegalArgumentException("A button either sends data or opens a link");
        }
    }
}

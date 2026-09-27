package ru.teacherbox.shared.chat;

import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * A button under a message: either a choice that comes back to the action as
 * {@link ChatInput.Choice} or a link that the messenger opens.
 *
 * @param label text on the button; messengers cut long labels, keep it within {@value ChatKit#MAX_LABEL} characters
 * @param value what the action gets back (stored on the server, any length)
 * @param url   address the button opens
 */
public record ChatButton(String label, @Nullable String value, @Nullable String url) {

    public ChatButton {
        Objects.requireNonNull(label, "label");
        if (label.isBlank()) {
            throw new IllegalArgumentException("A button needs a label");
        }
        if ((value == null) == (url == null)) {
            throw new IllegalArgumentException("A button is either a choice or a link");
        }
    }

    public static ChatButton choice(String label, String value) {
        return new ChatButton(ChatKit.label(label), Objects.requireNonNull(value, "value"), null);
    }

    public static ChatButton link(String label, String url) {
        return new ChatButton(ChatKit.label(label), null, Objects.requireNonNull(url, "url"));
    }
}

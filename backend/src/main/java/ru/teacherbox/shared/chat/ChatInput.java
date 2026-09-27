package ru.teacherbox.shared.chat;

import java.util.Objects;

/** What the user sent: a message or a pressed button. */
public sealed interface ChatInput {

    /** A text message, stripped of surrounding whitespace. */
    record Text(String text) implements ChatInput {

        public Text {
            text = Objects.requireNonNull(text, "text").strip();
        }
    }

    /** A pressed button: its {@link ChatButton#value()}. */
    record Choice(String value) implements ChatInput {

        public Choice {
            Objects.requireNonNull(value, "value");
        }
    }
}

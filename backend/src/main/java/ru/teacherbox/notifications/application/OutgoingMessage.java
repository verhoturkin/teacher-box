package ru.teacherbox.notifications.application;

import java.util.List;
import java.util.Objects;

/** A message to send to a messenger: text and rows of buttons. */
public record OutgoingMessage(String text, List<List<OutgoingButton>> rows) {

    public OutgoingMessage {
        Objects.requireNonNull(text, "text");
        rows = rows.stream().filter(row -> !row.isEmpty()).map(List::copyOf).toList();
    }

    public static OutgoingMessage text(String text) {
        return new OutgoingMessage(text, List.of());
    }
}

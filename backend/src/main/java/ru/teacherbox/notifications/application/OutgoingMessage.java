package ru.teacherbox.notifications.application;

import java.util.ArrayList;
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

    /** Some button opens a link. */
    public boolean hasLinks() {
        return rows.stream().flatMap(List::stream).anyMatch(button -> button.url() != null);
    }

    /**
     * The links of the buttons moved into the text, one per line, the other buttons kept: for a messenger
     * that refused a link button (Telegram takes no address on a local network or without a domain).
     */
    public OutgoingMessage linksInText() {
        StringBuilder text = new StringBuilder(this.text);
        List<List<OutgoingButton>> kept = new ArrayList<>();
        for (List<OutgoingButton> row : rows) {
            List<OutgoingButton> choices = new ArrayList<>();
            for (OutgoingButton button : row) {
                if (button.url() == null) {
                    choices.add(button);
                } else {
                    text.append('\n').append(button.label()).append(": ").append(button.url());
                }
            }
            kept.add(choices);
        }
        return new OutgoingMessage(text.toString(), kept);
    }
}

package ru.teacherbox.shared.chat;

import java.util.List;
import java.util.Objects;

/** Buttons of an action under a notification, and the state its dialog starts from when one is pressed. */
public record ChatOffer(List<List<ChatButton>> rows, ChatState state) {

    public ChatOffer {
        rows = rows.stream().filter(row -> !row.isEmpty()).map(List::copyOf).toList();
        Objects.requireNonNull(state, "state");
    }
}

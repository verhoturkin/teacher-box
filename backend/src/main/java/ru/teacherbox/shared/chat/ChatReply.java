package ru.teacherbox.shared.chat;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * A message of the bot: text and rows of buttons. Messengers limit keyboards (VK: 10 buttons,
 * 5 in a row), so a reply should have at most {@value ChatKit#MAX_BUTTONS} buttons including the ones
 * the bot adds («Отмена», «Меню»).
 */
public record ChatReply(String text, List<List<ChatButton>> rows) {

    public ChatReply {
        Objects.requireNonNull(text, "text");
        rows = rows.stream().filter(row -> !row.isEmpty()).map(List::copyOf).toList();
    }

    public static ChatReply of(String text) {
        return new ChatReply(text, List.of());
    }

    /** This reply with one more row of buttons. */
    public ChatReply row(ChatButton... buttons) {
        return rows(List.of(List.of(buttons)));
    }

    /** This reply with more rows of buttons. */
    public ChatReply rows(List<List<ChatButton>> more) {
        List<List<ChatButton>> all = new ArrayList<>(rows);
        all.addAll(more);
        return new ChatReply(text, all);
    }

    public int buttons() {
        return rows.stream().mapToInt(List::size).sum();
    }
}

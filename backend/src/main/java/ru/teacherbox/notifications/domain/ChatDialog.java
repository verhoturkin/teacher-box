package ru.teacherbox.notifications.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.chat.ChatState;

/**
 * The dialog of a messenger chat with the bot (ADR-0013).
 *
 * @param recipientId the account the chat acts for; chosen by the user when several are connected
 * @param actionId    the action waiting for the next message, until {@code expiresAt}
 */
public record ChatDialog(ChannelType channel, String externalId, @Nullable UUID recipientId,
        @Nullable String actionId, ChatState state, @Nullable Instant expiresAt) {

    public ChatDialog {
        Objects.requireNonNull(channel, "channel");
        Objects.requireNonNull(externalId, "externalId");
        Objects.requireNonNull(state, "state");
    }

    public static ChatDialog idle(ChannelType channel, String externalId) {
        return new ChatDialog(channel, externalId, null, null, ChatState.EMPTY, null);
    }

    /** The action waiting for input, unless the user left the dialog for too long. */
    public Optional<String> waitingAction(Instant now) {
        return actionId != null && expiresAt != null && expiresAt.isAfter(now)
                ? Optional.of(actionId)
                : Optional.empty();
    }

    public ChatDialog actingFor(@Nullable UUID recipient) {
        return new ChatDialog(channel, externalId, recipient, actionId, state, expiresAt);
    }

    public ChatDialog waitFor(String action, ChatState next, Instant until) {
        return new ChatDialog(channel, externalId, recipientId, action, next, until);
    }

    public ChatDialog finished() {
        return new ChatDialog(channel, externalId, recipientId, null, ChatState.EMPTY, null);
    }
}

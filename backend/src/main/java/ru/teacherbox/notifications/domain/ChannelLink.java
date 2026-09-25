package ru.teacherbox.notifications.domain;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A recipient's account in a messenger.
 *
 * @param externalId   id of the chat/user in the messenger
 * @param displayName  how the account is shown in the UI (e.g. {@code @maria})
 * @param enabled      the recipient may pause a channel without unlinking it
 */
public record ChannelLink(
        UUID id,
        UUID recipientId,
        ChannelType channel,
        String externalId,
        @Nullable String displayName,
        boolean enabled,
        Instant linkedAt) {

    public ChannelLink withEnabled(boolean value) {
        return new ChannelLink(id, recipientId, channel, externalId, displayName, value, linkedAt);
    }
}

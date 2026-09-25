package ru.teacherbox.notifications.domain;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A one-time code (stored as a hash) that connects a messenger account to a recipient. */
public record LinkCode(
        String codeHash,
        UUID recipientId,
        ChannelType channel,
        Instant createdAt,
        Instant expiresAt,
        @Nullable Instant usedAt) {

    public boolean isUsable(Instant now) {
        return usedAt == null && now.isBefore(expiresAt);
    }
}

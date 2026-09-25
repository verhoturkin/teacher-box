package ru.teacherbox.identity.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** One-time invitation link. Only the SHA-256 hash of the secret token is stored. */
public final class Invite {

    private final UUID id;
    private final UUID userId;
    private final InvitePurpose purpose;
    private final String tokenHash;
    private final Instant createdAt;
    private final Instant expiresAt;
    private @Nullable Instant usedAt;
    private @Nullable Instant revokedAt;

    private Invite(UUID id, UUID userId, InvitePurpose purpose, String tokenHash, Instant createdAt,
            Instant expiresAt, @Nullable Instant usedAt, @Nullable Instant revokedAt) {
        this.id = id;
        this.userId = userId;
        this.purpose = purpose;
        this.tokenHash = tokenHash;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.usedAt = usedAt;
        this.revokedAt = revokedAt;
    }

    public static Invite issue(UUID id, UUID userId, InvitePurpose purpose, String tokenHash, Instant now,
            Duration ttl) {
        return new Invite(id, userId, purpose, tokenHash, now, now.plus(ttl), null, null);
    }

    public static Invite restore(UUID id, UUID userId, InvitePurpose purpose, String tokenHash, Instant createdAt,
            Instant expiresAt, @Nullable Instant usedAt, @Nullable Instant revokedAt) {
        return new Invite(id, userId, purpose, tokenHash, createdAt, expiresAt, usedAt, revokedAt);
    }

    public boolean isUsable(Instant now) {
        return usedAt == null && revokedAt == null && now.isBefore(expiresAt);
    }

    public void markUsed(Instant now) {
        usedAt = now;
    }

    public void revoke(Instant now) {
        if (usedAt == null && revokedAt == null) {
            revokedAt = now;
        }
    }

    public UUID id() {
        return id;
    }

    public UUID userId() {
        return userId;
    }

    public InvitePurpose purpose() {
        return purpose;
    }

    public String tokenHash() {
        return tokenHash;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant expiresAt() {
        return expiresAt;
    }

    public @Nullable Instant usedAt() {
        return usedAt;
    }

    public @Nullable Instant revokedAt() {
        return revokedAt;
    }
}

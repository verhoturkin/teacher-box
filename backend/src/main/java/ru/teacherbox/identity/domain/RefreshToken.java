package ru.teacherbox.identity.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Rotating refresh token (ADR-0003). Tokens issued from one sign-in form a family; each refresh
 * replaces the token with a new one of the same family. Presenting an already replaced token outside
 * the grace period indicates theft, and the whole family is revoked.
 */
public final class RefreshToken {

    private final UUID id;
    private final UUID userId;
    private final UUID familyId;
    private final String tokenHash;
    private final Instant createdAt;
    private final Instant expiresAt;
    private @Nullable Instant revokedAt;
    private @Nullable UUID replacedBy;

    private RefreshToken(UUID id, UUID userId, UUID familyId, String tokenHash, Instant createdAt,
            Instant expiresAt, @Nullable Instant revokedAt, @Nullable UUID replacedBy) {
        this.id = id;
        this.userId = userId;
        this.familyId = familyId;
        this.tokenHash = tokenHash;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.revokedAt = revokedAt;
        this.replacedBy = replacedBy;
    }

    public static RefreshToken issue(UUID id, UUID userId, UUID familyId, String tokenHash, Instant now,
            Duration ttl) {
        return new RefreshToken(id, userId, familyId, tokenHash, now, now.plus(ttl), null, null);
    }

    public static RefreshToken restore(UUID id, UUID userId, UUID familyId, String tokenHash, Instant createdAt,
            Instant expiresAt, @Nullable Instant revokedAt, @Nullable UUID replacedBy) {
        return new RefreshToken(id, userId, familyId, tokenHash, createdAt, expiresAt, revokedAt, replacedBy);
    }

    public boolean isExpired(Instant now) {
        return !now.isBefore(expiresAt);
    }

    public boolean isRevoked() {
        return revokedAt != null;
    }

    /**
     * {@code true} if the token was replaced only moments ago: concurrent refresh requests (e.g. two
     * browser tabs) are not treated as token theft.
     */
    public boolean wasJustRotated(Duration grace, Instant now) {
        return replacedBy != null && revokedAt != null && now.isBefore(revokedAt.plus(grace));
    }

    public void rotate(UUID replacementId, Instant now) {
        revokedAt = now;
        replacedBy = replacementId;
    }

    public UUID id() {
        return id;
    }

    public UUID userId() {
        return userId;
    }

    public UUID familyId() {
        return familyId;
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

    public @Nullable Instant revokedAt() {
        return revokedAt;
    }

    public @Nullable UUID replacedBy() {
        return replacedBy;
    }
}

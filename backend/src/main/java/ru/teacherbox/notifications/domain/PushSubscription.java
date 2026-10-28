package ru.teacherbox.notifications.domain;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A browser of a user that receives web push (ADR-0051).
 *
 * @param endpoint the address of the device's account at the push service: a secret, never logged or shown
 * @param p256dh   the device's public key, base64url
 * @param auth     the device's authentication secret, base64url
 * @param failures deliveries in a row that did not get through
 */
public record PushSubscription(UUID id, UUID userId, String endpoint, String p256dh, String auth,
        @Nullable String userAgent, @Nullable String language, Instant createdAt, @Nullable Instant lastSuccessAt,
        int failures) {

    @Override
    public String toString() {
        return "PushSubscription[id=" + id + "]";
    }
}

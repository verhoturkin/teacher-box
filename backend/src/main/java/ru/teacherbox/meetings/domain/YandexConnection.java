package ru.teacherbox.meetings.domain;

import java.time.Instant;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * The teacher's Yandex account used for the Telemost API: the OAuth client entered in the settings
 * and the tokens of the connection.
 *
 * @param waitingRoom students wait in the waiting room until the teacher lets them in
 */
public record YandexConnection(
        @Nullable String clientId,
        @Nullable String clientSecret,
        @Nullable String accessToken,
        @Nullable String refreshToken,
        @Nullable Instant accessExpiresAt,
        YandexStatus status,
        boolean waitingRoom,
        @Nullable String lastError,
        @Nullable Instant connectedAt,
        Instant updatedAt) {

    static final int MAX_ERROR = 1000;

    public YandexConnection {
        Objects.requireNonNull(status);
        Objects.requireNonNull(updatedAt);
        lastError = lastError == null || lastError.length() <= MAX_ERROR ? lastError : lastError.substring(0, MAX_ERROR);
    }

    public static YandexConnection none(Instant now) {
        return new YandexConnection(null, null, null, null, null, YandexStatus.NOT_CONNECTED, false, null, null, now);
    }

    public YandexConnection withClient(String id, String secret, Instant now) {
        return new YandexConnection(id, secret, accessToken, refreshToken, accessExpiresAt, status, waitingRoom,
                lastError, connectedAt, now);
    }

    public YandexConnection withWaitingRoom(boolean enabled, Instant now) {
        return new YandexConnection(clientId, clientSecret, accessToken, refreshToken, accessExpiresAt, status, enabled,
                lastError, connectedAt, now);
    }

    public YandexConnection connected(String access, @Nullable String refresh, Instant expiresAt, Instant now) {
        return new YandexConnection(clientId, clientSecret, access, refresh, expiresAt, YandexStatus.CONNECTED,
                waitingRoom, null, now, now);
    }

    /** A refreshed access token; the refresh token may change as well. */
    public YandexConnection refreshed(String access, @Nullable String refresh, Instant expiresAt, Instant now) {
        return new YandexConnection(clientId, clientSecret, access, refresh == null ? refreshToken : refresh,
                expiresAt, status, waitingRoom, lastError, connectedAt, now);
    }

    public YandexConnection needsReconnect(String error, Instant now) {
        return new YandexConnection(clientId, clientSecret, null, null, null, YandexStatus.NEEDS_RECONNECT,
                waitingRoom, error, connectedAt, now);
    }

    public YandexConnection failed(String error, Instant now) {
        return new YandexConnection(clientId, clientSecret, accessToken, refreshToken, accessExpiresAt, status,
                waitingRoom, error, connectedAt, now);
    }

    public YandexConnection disconnected(Instant now) {
        return new YandexConnection(clientId, clientSecret, null, null, null, YandexStatus.NOT_CONNECTED,
                waitingRoom, null, null, now);
    }

    public boolean isConnected() {
        return status == YandexStatus.CONNECTED && accessToken != null;
    }
}

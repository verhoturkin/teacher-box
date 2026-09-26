package ru.teacherbox.schedule.domain;

import java.time.Instant;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * The teacher's Google Calendar connection (one per instance): the OAuth client entered in the
 * settings, the refresh token and the calendar the portal created.
 *
 * @param calendarId  the portal's own calendar; kept after disconnecting so that reconnecting reuses it
 * @param busyEnabled the teacher allowed reading busy times of their own calendars
 */
public record GoogleConnection(
        @Nullable String clientId,
        @Nullable String clientSecret,
        @Nullable String refreshToken,
        @Nullable String calendarId,
        boolean busyEnabled,
        GoogleStatus status,
        @Nullable String lastError,
        @Nullable Instant lastSyncAt,
        @Nullable Instant connectedAt,
        Instant updatedAt) {

    static final int MAX_ERROR = 1000;

    public GoogleConnection {
        Objects.requireNonNull(status);
        Objects.requireNonNull(updatedAt);
        lastError = lastError == null || lastError.length() <= MAX_ERROR ? lastError : lastError.substring(0, MAX_ERROR);
    }

    public static GoogleConnection none(Instant now) {
        return new GoogleConnection(null, null, null, null, false, GoogleStatus.NOT_CONNECTED, null, null, null, now);
    }

    public GoogleConnection withClient(String id, String secret, Instant now) {
        return new GoogleConnection(id, secret, refreshToken, calendarId, busyEnabled, status, lastError, lastSyncAt,
                connectedAt, now);
    }

    public GoogleConnection connected(String token, String calendar, boolean busy, Instant now) {
        return new GoogleConnection(clientId, clientSecret, token, calendar, busy, GoogleStatus.CONNECTED, null, null,
                now, now);
    }

    public GoogleConnection needsReconnect(String error, Instant now) {
        return new GoogleConnection(clientId, clientSecret, null, calendarId, busyEnabled,
                GoogleStatus.NEEDS_RECONNECT, error, lastSyncAt, connectedAt, now);
    }

    public GoogleConnection disconnected(Instant now) {
        return new GoogleConnection(clientId, clientSecret, null, calendarId, false, GoogleStatus.NOT_CONNECTED, null,
                null, null, now);
    }

    public GoogleConnection synced(Instant now) {
        return new GoogleConnection(clientId, clientSecret, refreshToken, calendarId, busyEnabled, status, null, now,
                connectedAt, now);
    }

    public GoogleConnection failed(String error, Instant now) {
        return new GoogleConnection(clientId, clientSecret, refreshToken, calendarId, busyEnabled, status, error,
                lastSyncAt, connectedAt, now);
    }

    public boolean isConnected() {
        return status == GoogleStatus.CONNECTED && refreshToken != null && calendarId != null;
    }
}

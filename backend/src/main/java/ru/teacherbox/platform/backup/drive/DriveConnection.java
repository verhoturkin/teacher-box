package ru.teacherbox.platform.backup.drive;

import java.time.Instant;
import org.jspecify.annotations.Nullable;

/**
 * The teacher's Google Drive connection (one per server, ADR-0037): the OAuth client entered in the
 * interface, the refresh token, the portal's folder and how the last upload went.
 *
 * @param folderId  the portal's folder; kept after disconnecting so that reconnecting reuses it
 * @param account   address of the Google account, shown to the teacher
 * @param lastError why the last upload or download failed; {@code null} after a success
 */
public record DriveConnection(
        @Nullable String clientId,
        @Nullable String clientSecret,
        @Nullable String refreshToken,
        @Nullable String folderId,
        @Nullable String account,
        @Nullable Instant connectedAt,
        @Nullable Instant lastUploadAt,
        @Nullable String lastUploadName,
        @Nullable String lastError) {

    static final int MAX_ERROR = 1000;

    public DriveConnection {
        lastError = lastError == null || lastError.length() <= MAX_ERROR ? lastError : lastError.substring(0, MAX_ERROR);
    }

    static DriveConnection none() {
        return new DriveConnection(null, null, null, null, null, null, null, null, null);
    }

    DriveConnection withClient(String id, String secret) {
        return new DriveConnection(id, secret, refreshToken, folderId, account, connectedAt, lastUploadAt,
                lastUploadName, lastError);
    }

    DriveConnection connected(String token, String folder, String email, Instant now) {
        return new DriveConnection(clientId, clientSecret, token, folder, email.isEmpty() ? null : email, now,
                lastUploadAt, lastUploadName, null);
    }

    /** Disconnected by the teacher, or Google no longer accepts the token ({@code error}). */
    DriveConnection disconnected(@Nullable String error) {
        return new DriveConnection(clientId, clientSecret, null, folderId, null, null, lastUploadAt, lastUploadName,
                error);
    }

    DriveConnection uploaded(String name, Instant now) {
        return new DriveConnection(clientId, clientSecret, refreshToken, folderId, account, connectedAt, now, name,
                null);
    }

    DriveConnection withFolder(String folder) {
        return new DriveConnection(clientId, clientSecret, refreshToken, folder, account, connectedAt, lastUploadAt,
                lastUploadName, lastError);
    }

    DriveConnection failed(@Nullable String error) {
        return new DriveConnection(clientId, clientSecret, refreshToken, folderId, account, connectedAt, lastUploadAt,
                lastUploadName, error);
    }

    boolean isConnected() {
        return refreshToken != null;
    }
}

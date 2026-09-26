package ru.teacherbox.schedule.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.schedule.domain.GoogleConnection;
import ru.teacherbox.schedule.domain.GoogleStatus;

/**
 * The Google Calendar connection (a single row), the authorizations waiting for Google's answer and
 * the lessons already put into the calendar.
 */
@Repository
public class GoogleRepository {

    /** An authorization the teacher started; used once. */
    public record PendingAuthorization(String redirectUri, boolean busy) {
    }

    private final JdbcClient jdbc;

    public GoogleRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<GoogleConnection> connection() {
        return jdbc.sql("""
                select client_id, client_secret, refresh_token, calendar_id, busy_enabled, status, last_error,
                       last_sync_at, connected_at, updated_at
                from schedule.google_connection where id = 1
                """)
                .query(this::map)
                .optional();
    }

    public void save(GoogleConnection connection) {
        jdbc.sql("""
                merge into schedule.google_connection (id, client_id, client_secret, refresh_token, calendar_id,
                    busy_enabled, status, last_error, last_sync_at, connected_at, updated_at)
                key (id) values (1, :clientId, :clientSecret, :refreshToken, :calendarId, :busy, :status, :error,
                    :lastSync, :connectedAt, :updatedAt)
                """)
                .param("clientId", connection.clientId())
                .param("clientSecret", connection.clientSecret())
                .param("refreshToken", connection.refreshToken())
                .param("calendarId", connection.calendarId())
                .param("busy", connection.busyEnabled())
                .param("status", connection.status().name())
                .param("error", connection.lastError())
                .param("lastSync", connection.lastSyncAt())
                .param("connectedAt", connection.connectedAt())
                .param("updatedAt", connection.updatedAt())
                .update();
    }

    public void addAuthorization(String stateHash, String redirectUri, boolean busy, Instant expiresAt) {
        jdbc.sql("""
                insert into schedule.google_oauth_states (state_hash, redirect_uri, busy, expires_at)
                values (:hash, :redirectUri, :busy, :expiresAt)
                """)
                .param("hash", stateHash)
                .param("redirectUri", redirectUri)
                .param("busy", busy)
                .param("expiresAt", expiresAt)
                .update();
    }

    /** Removes and returns an authorization that has not expired (expired ones are removed too). */
    @Transactional
    public Optional<PendingAuthorization> takeAuthorization(String stateHash, Instant now) {
        Optional<PendingAuthorization> found = jdbc.sql("""
                select redirect_uri, busy from schedule.google_oauth_states
                where state_hash = :hash and expires_at > :now
                """)
                .param("hash", stateHash)
                .param("now", now)
                .query((rs, rowNum) -> new PendingAuthorization(rs.getString("redirect_uri"), rs.getBoolean("busy")))
                .optional();
        jdbc.sql("delete from schedule.google_oauth_states where state_hash = :hash or expires_at <= :now")
                .param("hash", stateHash)
                .param("now", now)
                .update();
        return found;
    }

    /** Versions of the lessons as they were put into the calendar. */
    public Map<UUID, Long> syncedVersions() {
        Map<UUID, Long> versions = new HashMap<>();
        jdbc.sql("select lesson_id, synced_version from schedule.google_events")
                .query(rs -> {
                    versions.put(rs.getObject("lesson_id", UUID.class), rs.getLong("synced_version"));
                });
        return versions;
    }

    public void markSynced(UUID lessonId, long version, Instant now) {
        jdbc.sql("""
                merge into schedule.google_events (lesson_id, synced_version, synced_at)
                key (lesson_id) values (:lessonId, :version, :now)
                """)
                .param("lessonId", lessonId)
                .param("version", version)
                .param("now", now)
                .update();
    }

    public void forget(UUID lessonId) {
        jdbc.sql("delete from schedule.google_events where lesson_id = :lessonId").param("lessonId", lessonId).update();
    }

    public void forgetAll() {
        jdbc.sql("delete from schedule.google_events").update();
    }

    /** Events of lessons that no longer exist (removed with a changed series). */
    public List<UUID> orphans() {
        return jdbc.sql("""
                select e.lesson_id from schedule.google_events e
                left join schedule.lessons l on l.id = e.lesson_id
                where l.id is null
                """)
                .query(UUID.class)
                .list();
    }

    private GoogleConnection map(ResultSet rs, int rowNum) throws SQLException {
        return new GoogleConnection(
                rs.getString("client_id"),
                rs.getString("client_secret"),
                rs.getString("refresh_token"),
                rs.getString("calendar_id"),
                rs.getBoolean("busy_enabled"),
                GoogleStatus.valueOf(rs.getString("status")),
                rs.getString("last_error"),
                nullableInstant(rs, "last_sync_at"),
                nullableInstant(rs, "connected_at"),
                rs.getObject("updated_at", Instant.class));
    }

    private static @Nullable Instant nullableInstant(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, Instant.class);
    }
}

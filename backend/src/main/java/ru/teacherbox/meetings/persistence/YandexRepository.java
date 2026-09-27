package ru.teacherbox.meetings.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.meetings.domain.YandexConnection;
import ru.teacherbox.meetings.domain.YandexStatus;

/** The teacher's Yandex connection and the authorizations in progress. */
@Repository
public class YandexRepository {

    private final JdbcClient jdbc;

    public YandexRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<YandexConnection> connection() {
        return jdbc.sql("""
                select client_id, client_secret, access_token, refresh_token, access_expires_at, status,
                       waiting_room, last_error, connected_at, updated_at
                from meetings.yandex_connection where id = 1
                """)
                .query(YandexRepository::map)
                .optional();
    }

    public void save(YandexConnection connection) {
        jdbc.sql("""
                merge into meetings.yandex_connection (id, client_id, client_secret, access_token, refresh_token,
                    access_expires_at, status, waiting_room, last_error, connected_at, updated_at)
                key (id) values (1, :clientId, :clientSecret, :accessToken, :refreshToken, :expiresAt, :status,
                    :waitingRoom, :error, :connectedAt, :updatedAt)
                """)
                .param("clientId", connection.clientId())
                .param("clientSecret", connection.clientSecret())
                .param("accessToken", connection.accessToken())
                .param("refreshToken", connection.refreshToken())
                .param("expiresAt", connection.accessExpiresAt())
                .param("status", connection.status().name())
                .param("waitingRoom", connection.waitingRoom())
                .param("error", connection.lastError())
                .param("connectedAt", connection.connectedAt())
                .param("updatedAt", connection.updatedAt())
                .update();
    }

    public void addAuthorization(String stateHash, String redirectUri, Instant expiresAt) {
        jdbc.sql("""
                insert into meetings.yandex_oauth_states (state_hash, redirect_uri, expires_at)
                values (:hash, :redirectUri, :expiresAt)
                """)
                .param("hash", stateHash)
                .param("redirectUri", redirectUri)
                .param("expiresAt", expiresAt)
                .update();
    }

    /**
     * Removes and returns the redirect address of an authorization that has not expired (expired
     * ones are removed too).
     */
    @Transactional
    public Optional<String> takeAuthorization(String stateHash, Instant now) {
        Optional<String> found = jdbc.sql("""
                select redirect_uri from meetings.yandex_oauth_states
                where state_hash = :hash and expires_at > :now
                """)
                .param("hash", stateHash)
                .param("now", now)
                .query(String.class)
                .optional();
        jdbc.sql("delete from meetings.yandex_oauth_states where state_hash = :hash or expires_at <= :now")
                .param("hash", stateHash)
                .param("now", now)
                .update();
        return found;
    }

    private static YandexConnection map(ResultSet rs, int rowNum) throws SQLException {
        return new YandexConnection(
                rs.getString("client_id"),
                rs.getString("client_secret"),
                rs.getString("access_token"),
                rs.getString("refresh_token"),
                rs.getObject("access_expires_at", Instant.class),
                YandexStatus.valueOf(rs.getString("status")),
                rs.getBoolean("waiting_room"),
                rs.getString("last_error"),
                rs.getObject("connected_at", Instant.class),
                rs.getObject("updated_at", Instant.class));
    }
}

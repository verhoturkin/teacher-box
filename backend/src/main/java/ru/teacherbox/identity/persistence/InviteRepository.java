package ru.teacherbox.identity.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.identity.domain.Invite;
import ru.teacherbox.identity.domain.InvitePurpose;

@Repository
public class InviteRepository {

    private static final String SELECT = """
            select id, user_id, purpose, token_hash, created_at, expires_at, used_at, revoked_at
            from identity.invites
            """;

    private final JdbcClient jdbc;

    public InviteRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Invite invite) {
        jdbc.sql("""
                insert into identity.invites (id, user_id, purpose, token_hash, created_at, expires_at, used_at,
                    revoked_at)
                values (:id, :userId, :purpose, :tokenHash, :createdAt, :expiresAt, :usedAt, :revokedAt)
                """)
                .param("id", invite.id())
                .param("userId", invite.userId())
                .param("purpose", invite.purpose().name())
                .param("tokenHash", invite.tokenHash())
                .param("createdAt", invite.createdAt())
                .param("expiresAt", invite.expiresAt())
                .param("usedAt", invite.usedAt())
                .param("revokedAt", invite.revokedAt())
                .update();
    }

    public void update(Invite invite) {
        jdbc.sql("update identity.invites set used_at = :usedAt, revoked_at = :revokedAt where id = :id")
                .param("id", invite.id())
                .param("usedAt", invite.usedAt())
                .param("revokedAt", invite.revokedAt())
                .update();
    }

    public Optional<Invite> findByTokenHash(String tokenHash) {
        return jdbc.sql(SELECT + " where token_hash = :tokenHash")
                .param("tokenHash", tokenHash)
                .query(InviteRepository::map)
                .optional();
    }

    /** The most recent invitation of the user that can still be used. */
    public Optional<Invite> findUsableByUser(UUID userId, Instant now) {
        return jdbc.sql(SELECT + """
                 where user_id = :userId and used_at is null and revoked_at is null and expires_at > :now
                 order by created_at desc
                 limit 1
                """)
                .param("userId", userId)
                .param("now", now)
                .query(InviteRepository::map)
                .optional();
    }

    /** Revokes every unused invitation of the user. */
    public void revokeUnusedByUser(UUID userId, Instant now) {
        jdbc.sql("""
                update identity.invites set revoked_at = :now
                where user_id = :userId and used_at is null and revoked_at is null
                """)
                .param("userId", userId)
                .param("now", now)
                .update();
    }

    private static Invite map(ResultSet rs, int rowNum) throws SQLException {
        return Invite.restore(
                rs.getObject("id", UUID.class),
                rs.getObject("user_id", UUID.class),
                InvitePurpose.valueOf(rs.getString("purpose")),
                rs.getString("token_hash"),
                rs.getObject("created_at", Instant.class),
                rs.getObject("expires_at", Instant.class),
                rs.getObject("used_at", Instant.class),
                rs.getObject("revoked_at", Instant.class));
    }
}

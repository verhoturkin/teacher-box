package ru.teacherbox.identity.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.identity.domain.RefreshToken;

@Repository
public class RefreshTokenRepository {

    private static final String SELECT = """
            select id, user_id, family_id, token_hash, created_at, expires_at, revoked_at, replaced_by
            from identity.refresh_tokens
            """;

    private final JdbcClient jdbc;

    public RefreshTokenRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(RefreshToken token) {
        jdbc.sql("""
                insert into identity.refresh_tokens (id, user_id, family_id, token_hash, created_at, expires_at,
                    revoked_at, replaced_by)
                values (:id, :userId, :familyId, :tokenHash, :createdAt, :expiresAt, :revokedAt, :replacedBy)
                """)
                .param("id", token.id())
                .param("userId", token.userId())
                .param("familyId", token.familyId())
                .param("tokenHash", token.tokenHash())
                .param("createdAt", token.createdAt())
                .param("expiresAt", token.expiresAt())
                .param("revokedAt", token.revokedAt())
                .param("replacedBy", token.replacedBy())
                .update();
    }

    public void update(RefreshToken token) {
        jdbc.sql("update identity.refresh_tokens set revoked_at = :revokedAt, replaced_by = :replacedBy where id = :id")
                .param("id", token.id())
                .param("revokedAt", token.revokedAt())
                .param("replacedBy", token.replacedBy())
                .update();
    }

    public Optional<RefreshToken> findByTokenHash(String tokenHash) {
        return jdbc.sql(SELECT + " where token_hash = :tokenHash")
                .param("tokenHash", tokenHash)
                .query(RefreshTokenRepository::map)
                .optional();
    }

    public int revokeFamily(UUID familyId, Instant now) {
        return jdbc.sql("""
                update identity.refresh_tokens set revoked_at = :now
                where family_id = :familyId and revoked_at is null
                """)
                .param("familyId", familyId)
                .param("now", now)
                .update();
    }

    public int revokeAllOfUser(UUID userId, Instant now) {
        return jdbc.sql("""
                update identity.refresh_tokens set revoked_at = :now
                where user_id = :userId and revoked_at is null
                """)
                .param("userId", userId)
                .param("now", now)
                .update();
    }

    private static RefreshToken map(ResultSet rs, int rowNum) throws SQLException {
        return RefreshToken.restore(
                rs.getObject("id", UUID.class),
                rs.getObject("user_id", UUID.class),
                rs.getObject("family_id", UUID.class),
                rs.getString("token_hash"),
                rs.getObject("created_at", Instant.class),
                rs.getObject("expires_at", Instant.class),
                rs.getObject("revoked_at", Instant.class),
                rs.getObject("replaced_by", UUID.class));
    }
}

package ru.teacherbox.notifications.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.LinkCode;

@Repository
public class LinkCodeRepository {

    private final JdbcClient jdbc;

    public LinkCodeRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(LinkCode code) {
        jdbc.sql("""
                insert into notifications.link_codes (code_hash, recipient_id, channel, created_at, expires_at, used_at)
                values (:hash, :recipientId, :channel, :createdAt, :expiresAt, :usedAt)
                """)
                .param("hash", code.codeHash())
                .param("recipientId", code.recipientId())
                .param("channel", code.channel().name())
                .param("createdAt", code.createdAt())
                .param("expiresAt", code.expiresAt())
                .param("usedAt", code.usedAt())
                .update();
    }

    public Optional<LinkCode> find(String codeHash, ChannelType channel) {
        return jdbc.sql("""
                select code_hash, recipient_id, channel, created_at, expires_at, used_at
                from notifications.link_codes where code_hash = :hash and channel = :channel
                """)
                .param("hash", codeHash)
                .param("channel", channel.name())
                .query(LinkCodeRepository::map)
                .optional();
    }

    /** @return {@code true} if the code was still unused (guards against a concurrent second use) */
    public boolean markUsed(String codeHash, Instant now) {
        return jdbc.sql("""
                update notifications.link_codes set used_at = :now where code_hash = :hash and used_at is null
                """)
                .param("hash", codeHash)
                .param("now", now)
                .update() == 1;
    }

    /** Invalidates earlier unused codes of the recipient for the channel and forgets everybody's expired codes. */
    public void deleteStale(UUID recipientId, ChannelType channel, Instant now) {
        jdbc.sql("""
                delete from notifications.link_codes
                where (recipient_id = :recipientId and channel = :channel and used_at is null) or expires_at < :now
                """)
                .param("recipientId", recipientId)
                .param("channel", channel.name())
                .param("now", now)
                .update();
    }

    private static LinkCode map(ResultSet rs, int rowNum) throws SQLException {
        return new LinkCode(
                rs.getString("code_hash"),
                rs.getObject("recipient_id", UUID.class),
                ChannelType.valueOf(rs.getString("channel")),
                rs.getObject("created_at", Instant.class),
                rs.getObject("expires_at", Instant.class),
                rs.getObject("used_at", Instant.class));
    }
}

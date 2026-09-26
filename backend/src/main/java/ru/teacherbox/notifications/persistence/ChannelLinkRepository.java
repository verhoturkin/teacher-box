package ru.teacherbox.notifications.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;

@Repository
public class ChannelLinkRepository {

    private static final String SELECT = """
            select id, recipient_id, channel, external_id, display_name, enabled, linked_at
            from notifications.channel_links
            """;

    private final JdbcClient jdbc;

    public ChannelLinkRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Replaces the recipient's link to the same channel, if any. */
    public void save(ChannelLink link) {
        delete(link.recipientId(), link.channel());
        jdbc.sql("""
                insert into notifications.channel_links
                    (id, recipient_id, channel, external_id, display_name, enabled, linked_at)
                values (:id, :recipientId, :channel, :externalId, :displayName, :enabled, :linkedAt)
                """)
                .param("id", link.id())
                .param("recipientId", link.recipientId())
                .param("channel", link.channel().name())
                .param("externalId", link.externalId())
                .param("displayName", link.displayName())
                .param("enabled", link.enabled())
                .param("linkedAt", link.linkedAt())
                .update();
    }

    public void updateEnabled(UUID id, boolean enabled) {
        jdbc.sql("update notifications.channel_links set enabled = :enabled where id = :id")
                .param("id", id)
                .param("enabled", enabled)
                .update();
    }

    public List<ChannelLink> findByRecipient(UUID recipientId) {
        return jdbc.sql(SELECT + " where recipient_id = :recipientId order by channel")
                .param("recipientId", recipientId)
                .query(ChannelLinkRepository::map)
                .list();
    }

    /** Connected accounts of all users. */
    public List<ChannelLink> findAll() {
        return jdbc.sql(SELECT + " order by recipient_id, channel").query(ChannelLinkRepository::map).list();
    }

    public Optional<ChannelLink> find(UUID recipientId, ChannelType channel) {
        return jdbc.sql(SELECT + " where recipient_id = :recipientId and channel = :channel")
                .param("recipientId", recipientId)
                .param("channel", channel.name())
                .query(ChannelLinkRepository::map)
                .optional();
    }

    public List<ChannelLink> findByExternal(ChannelType channel, String externalId) {
        return jdbc.sql(SELECT + " where channel = :channel and external_id = :externalId")
                .param("channel", channel.name())
                .param("externalId", externalId)
                .query(ChannelLinkRepository::map)
                .list();
    }

    /** @return {@code true} if a link was removed */
    public boolean delete(UUID recipientId, ChannelType channel) {
        return jdbc.sql("""
                delete from notifications.channel_links where recipient_id = :recipientId and channel = :channel
                """)
                .param("recipientId", recipientId)
                .param("channel", channel.name())
                .update() > 0;
    }

    private static ChannelLink map(ResultSet rs, int rowNum) throws SQLException {
        return new ChannelLink(
                rs.getObject("id", UUID.class),
                rs.getObject("recipient_id", UUID.class),
                ChannelType.valueOf(rs.getString("channel")),
                rs.getString("external_id"),
                rs.getString("display_name"),
                rs.getBoolean("enabled"),
                rs.getObject("linked_at", Instant.class));
    }
}

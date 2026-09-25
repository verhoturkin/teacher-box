package ru.teacherbox.notifications.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.notifications.domain.InboxNotification;
import ru.teacherbox.notifications.domain.NotificationKind;

@Repository
public class InboxRepository {

    private static final String SELECT = """
            select id, recipient_id, kind, title, body, link, created_at, read_at from notifications.inbox
            """;

    private final JdbcClient jdbc;

    public InboxRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(InboxNotification notification) {
        jdbc.sql("""
                insert into notifications.inbox (id, recipient_id, kind, title, body, link, created_at, read_at)
                values (:id, :recipientId, :kind, :title, :body, :link, :createdAt, :readAt)
                """)
                .param("id", notification.id())
                .param("recipientId", notification.recipientId())
                .param("kind", notification.kind().name())
                .param("title", notification.title())
                .param("body", notification.body())
                .param("link", notification.link())
                .param("createdAt", notification.createdAt())
                .param("readAt", notification.readAt())
                .update();
    }

    public Optional<InboxNotification> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(InboxRepository::map).optional();
    }

    /** Newest first. */
    public List<InboxNotification> findPage(UUID recipientId, int offset, int limit) {
        return jdbc.sql(SELECT + """
                 where recipient_id = :recipientId
                 order by created_at desc, id desc
                 offset :offset rows fetch next :limit rows only
                """)
                .param("recipientId", recipientId)
                .param("offset", offset)
                .param("limit", limit)
                .query(InboxRepository::map)
                .list();
    }

    public long count(UUID recipientId) {
        return jdbc.sql("select count(*) from notifications.inbox where recipient_id = :recipientId")
                .param("recipientId", recipientId)
                .query(Long.class)
                .single();
    }

    public long countUnread(UUID recipientId) {
        return jdbc.sql("""
                select count(*) from notifications.inbox where recipient_id = :recipientId and read_at is null
                """)
                .param("recipientId", recipientId)
                .query(Long.class)
                .single();
    }

    /** @return {@code true} if the notification was unread */
    public boolean markRead(UUID id, Instant now) {
        return jdbc.sql("update notifications.inbox set read_at = :now where id = :id and read_at is null")
                .param("id", id)
                .param("now", now)
                .update() == 1;
    }

    /** @return number of notifications marked as read */
    public int markAllRead(UUID recipientId, Instant now) {
        return jdbc.sql("""
                update notifications.inbox set read_at = :now where recipient_id = :recipientId and read_at is null
                """)
                .param("recipientId", recipientId)
                .param("now", now)
                .update();
    }

    private static InboxNotification map(ResultSet rs, int rowNum) throws SQLException {
        return new InboxNotification(
                rs.getObject("id", UUID.class),
                rs.getObject("recipient_id", UUID.class),
                NotificationKind.valueOf(rs.getString("kind")),
                rs.getString("title"),
                rs.getString("body"),
                rs.getString("link"),
                rs.getObject("created_at", Instant.class),
                rs.getObject("read_at", Instant.class));
    }
}

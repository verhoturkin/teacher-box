package ru.teacherbox.notifications.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.Delivery;
import ru.teacherbox.notifications.domain.DeliveryStatus;

@Repository
public class DeliveryRepository {

    private static final String SELECT = """
            select id, notification_id, recipient_id, channel, external_id, text, status, attempts, next_attempt_at,
                last_error, created_at, sent_at
            from notifications.deliveries
            """;

    private final JdbcClient jdbc;

    public DeliveryRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Delivery delivery) {
        jdbc.sql("""
                insert into notifications.deliveries (id, notification_id, recipient_id, channel, external_id, text,
                    status, attempts, next_attempt_at, last_error, created_at, sent_at)
                values (:id, :notificationId, :recipientId, :channel, :externalId, :text, :status, :attempts,
                    :nextAttemptAt, :lastError, :createdAt, :sentAt)
                """)
                .param("id", delivery.id())
                .param("notificationId", delivery.notificationId())
                .param("recipientId", delivery.recipientId())
                .param("channel", delivery.channel().name())
                .param("externalId", delivery.externalId())
                .param("text", delivery.text())
                .param("status", delivery.status().name())
                .param("attempts", delivery.attempts())
                .param("nextAttemptAt", delivery.nextAttemptAt())
                .param("lastError", delivery.lastError())
                .param("createdAt", delivery.createdAt())
                .param("sentAt", delivery.sentAt())
                .update();
    }

    public void update(Delivery delivery) {
        jdbc.sql("""
                update notifications.deliveries
                set status = :status, attempts = :attempts, next_attempt_at = :nextAttemptAt, last_error = :lastError,
                    sent_at = :sentAt
                where id = :id
                """)
                .param("id", delivery.id())
                .param("status", delivery.status().name())
                .param("attempts", delivery.attempts())
                .param("nextAttemptAt", delivery.nextAttemptAt())
                .param("lastError", delivery.lastError())
                .param("sentAt", delivery.sentAt())
                .update();
    }

    /** Pending deliveries whose time has come, oldest first. */
    public List<Delivery> findDue(Instant now, int limit) {
        return jdbc.sql(SELECT + """
                 where status = 'PENDING' and next_attempt_at <= :now
                 order by next_attempt_at, id
                 fetch first :limit rows only
                """)
                .param("now", now)
                .param("limit", limit)
                .query(DeliveryRepository::map)
                .list();
    }

    public List<Delivery> findByRecipient(UUID recipientId) {
        return jdbc.sql(SELECT + " where recipient_id = :recipientId order by created_at, id")
                .param("recipientId", recipientId)
                .query(DeliveryRepository::map)
                .list();
    }

    /** The latest deliveries that were given up, newest first. */
    public List<Delivery> findFailed(int limit) {
        return jdbc.sql(SELECT + """
                 where status = 'FAILED'
                 order by created_at desc, id desc
                 fetch first :limit rows only
                """)
                .param("limit", limit)
                .query(DeliveryRepository::map)
                .list();
    }

    /** Gives up pending deliveries to a channel the recipient no longer uses. */
    public int cancelPending(UUID recipientId, ChannelType channel, String reason) {
        return jdbc.sql("""
                update notifications.deliveries set status = 'FAILED', last_error = :reason
                where recipient_id = :recipientId and channel = :channel and status = 'PENDING'
                """)
                .param("recipientId", recipientId)
                .param("channel", channel.name())
                .param("reason", reason)
                .update();
    }

    /** Removes sent and failed deliveries created before {@code cutoff}; pending ones stay. */
    public int deleteFinishedBefore(Instant cutoff) {
        return jdbc.sql("""
                delete from notifications.deliveries where status in ('SENT', 'FAILED') and created_at < :cutoff
                """)
                .param("cutoff", cutoff)
                .update();
    }

    private static Delivery map(ResultSet rs, int rowNum) throws SQLException {
        return Delivery.restore(
                rs.getObject("id", UUID.class),
                rs.getObject("notification_id", UUID.class),
                rs.getObject("recipient_id", UUID.class),
                ChannelType.valueOf(rs.getString("channel")),
                rs.getString("external_id"),
                rs.getString("text"),
                DeliveryStatus.valueOf(rs.getString("status")),
                rs.getInt("attempts"),
                rs.getObject("next_attempt_at", Instant.class),
                rs.getString("last_error"),
                rs.getObject("created_at", Instant.class),
                rs.getObject("sent_at", Instant.class));
    }
}

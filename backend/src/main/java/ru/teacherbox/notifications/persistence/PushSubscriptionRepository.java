package ru.teacherbox.notifications.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.notifications.domain.PushSubscription;

@Repository
public class PushSubscriptionRepository {

    /** Subscriptions and the ones whose last deliveries failed (for the administrator). */
    public record Counts(long subscriptions, long failing) {
    }

    private static final String SELECT = """
            select id, user_id, endpoint, p256dh, auth, user_agent, language, created_at, last_success_at, failures
            from notifications.push_subscriptions
            """;

    private final JdbcClient jdbc;

    public PushSubscriptionRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** The browser is subscribed again (the same endpoint): its keys and owner are replaced, failures reset. */
    public void save(PushSubscription subscription) {
        int updated = jdbc.sql("""
                update notifications.push_subscriptions
                set user_id = :userId, p256dh = :p256dh, auth = :auth, user_agent = :userAgent, language = :language,
                    failures = 0
                where endpoint = :endpoint
                """)
                .param("userId", subscription.userId())
                .param("p256dh", subscription.p256dh())
                .param("auth", subscription.auth())
                .param("userAgent", subscription.userAgent())
                .param("language", subscription.language())
                .param("endpoint", subscription.endpoint())
                .update();
        if (updated == 0) {
            jdbc.sql("""
                    insert into notifications.push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent,
                        language, created_at, last_success_at, failures)
                    values (:id, :userId, :endpoint, :p256dh, :auth, :userAgent, :language, :createdAt, null, 0)
                    """)
                    .param("id", subscription.id())
                    .param("userId", subscription.userId())
                    .param("endpoint", subscription.endpoint())
                    .param("p256dh", subscription.p256dh())
                    .param("auth", subscription.auth())
                    .param("userAgent", subscription.userAgent())
                    .param("language", subscription.language())
                    .param("createdAt", subscription.createdAt())
                    .update();
        }
    }

    public Optional<PushSubscription> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(PushSubscriptionRepository::map).optional();
    }

    public Optional<PushSubscription> findByEndpoint(String endpoint) {
        return jdbc.sql(SELECT + " where endpoint = :endpoint").param("endpoint", endpoint)
                .query(PushSubscriptionRepository::map).optional();
    }

    /** Oldest first. */
    public List<PushSubscription> findByUser(UUID userId) {
        return jdbc.sql(SELECT + " where user_id = :userId order by created_at, id").param("userId", userId)
                .query(PushSubscriptionRepository::map).list();
    }

    public void delete(UUID id) {
        jdbc.sql("delete from notifications.push_subscriptions where id = :id").param("id", id).update();
    }

    public void markSuccess(UUID id, Instant now) {
        jdbc.sql("update notifications.push_subscriptions set last_success_at = :now, failures = 0 where id = :id")
                .param("now", now).param("id", id).update();
    }

    public void markFailure(UUID id) {
        jdbc.sql("update notifications.push_subscriptions set failures = failures + 1 where id = :id")
                .param("id", id).update();
    }

    /**
     * Removes subscriptions that keep failing and have not got a message through since {@code since} (or ever,
     * counting from the subscription); a quiet but working device is kept.
     *
     * @return number removed
     */
    public int deleteStale(Instant since) {
        return jdbc.sql("""
                delete from notifications.push_subscriptions
                where failures > 0 and coalesce(last_success_at, created_at) < :since
                """)
                .param("since", since)
                .update();
    }

    public Counts counts() {
        return jdbc.sql("""
                select count(*) as subscriptions, count(case when failures > 0 then 1 end) as failing
                from notifications.push_subscriptions
                """)
                .query((rs, rowNum) -> new Counts(rs.getLong("subscriptions"), rs.getLong("failing")))
                .single();
    }

    private static PushSubscription map(ResultSet rs, int rowNum) throws SQLException {
        return new PushSubscription(rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class),
                rs.getString("endpoint"), rs.getString("p256dh"), rs.getString("auth"), rs.getString("user_agent"),
                rs.getString("language"), rs.getObject("created_at", Instant.class),
                rs.getObject("last_success_at", Instant.class), rs.getInt("failures"));
    }
}

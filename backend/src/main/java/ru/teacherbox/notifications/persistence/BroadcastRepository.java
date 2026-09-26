package ru.teacherbox.notifications.persistence;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Messages the teacher sent to students (the history on the notifications page). */
@Repository
public class BroadcastRepository {

    public record Broadcast(UUID id, String title, @Nullable String body, int recipients, Instant createdAt) {
    }

    private final JdbcClient jdbc;

    public BroadcastRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Broadcast broadcast) {
        jdbc.sql("""
                insert into notifications.broadcasts (id, title, body, recipients, created_at)
                values (:id, :title, :body, :recipients, :createdAt)
                """)
                .param("id", broadcast.id())
                .param("title", broadcast.title())
                .param("body", broadcast.body())
                .param("recipients", broadcast.recipients())
                .param("createdAt", broadcast.createdAt())
                .update();
    }

    /** The latest messages, newest first. */
    public List<Broadcast> findLatest(int limit) {
        return jdbc.sql("""
                select id, title, body, recipients, created_at from notifications.broadcasts
                order by created_at desc, id desc limit :limit
                """)
                .param("limit", limit)
                .query((rs, rowNum) -> new Broadcast(rs.getObject("id", UUID.class), rs.getString("title"),
                        rs.getString("body"), rs.getInt("recipients"), rs.getObject("created_at", Instant.class)))
                .list();
    }
}

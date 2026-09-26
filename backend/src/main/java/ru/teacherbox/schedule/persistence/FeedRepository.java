package ru.teacherbox.schedule.persistence;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Calendar feed tokens by owner (the teacher or a student); one link per owner. */
@Repository
public class FeedRepository {

    private final JdbcClient jdbc;

    public FeedRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Stores a new token hash, replacing the previous link of the owner. */
    public void replace(UUID ownerId, String tokenHash, Instant now) {
        jdbc.sql("""
                merge into schedule.feeds (owner_id, token_hash, created_at)
                key (owner_id) values (:ownerId, :hash, :now)
                """)
                .param("ownerId", ownerId)
                .param("hash", tokenHash)
                .param("now", now)
                .update();
    }

    public void delete(UUID ownerId) {
        jdbc.sql("delete from schedule.feeds where owner_id = :ownerId").param("ownerId", ownerId).update();
    }

    public Optional<Instant> createdAt(UUID ownerId) {
        return jdbc.sql("select created_at from schedule.feeds where owner_id = :ownerId")
                .param("ownerId", ownerId)
                .query(Instant.class)
                .optional();
    }

    public Optional<UUID> findOwner(String tokenHash) {
        return jdbc.sql("select owner_id from schedule.feeds where token_hash = :hash")
                .param("hash", tokenHash)
                .query(UUID.class)
                .optional();
    }
}

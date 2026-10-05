package ru.teacherbox.boards.persistence;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Excalidraw libraries of the users: the items as JSON, one row per user. */
@Repository
public class LibraryRepository {

    private final JdbcClient jdbc;

    public LibraryRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<String> find(UUID userId) {
        return jdbc.sql("select items from boards.board_libraries where user_id = :id").param("id", userId)
                .query(String.class).optional();
    }

    public void save(UUID userId, String items, Instant updatedAt) {
        jdbc.sql("""
                merge into boards.board_libraries (user_id, items, updated_at) key (user_id)
                values (:id, :items, :updatedAt)
                """)
                .param("id", userId)
                .param("items", items)
                .param("updatedAt", updatedAt)
                .update();
    }
}

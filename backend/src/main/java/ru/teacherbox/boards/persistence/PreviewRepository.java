package ru.teacherbox.boards.persistence;

import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The preview pictures of boards: a file key and the time of the last upload per board. */
@Repository
public class PreviewRepository {

    /** @param key the key in the {@code boards} namespace of the file storage */
    public record Preview(String key, long size, Instant updatedAt) {
    }

    private final JdbcClient jdbc;

    public PreviewRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Preview> find(UUID boardId) {
        return jdbc.sql("select file_key, size, updated_at from boards.board_previews where board_id = :id")
                .param("id", boardId)
                .query((rs, row) -> new Preview(rs.getString("file_key"), rs.getLong("size"),
                        rs.getObject("updated_at", Instant.class)))
                .optional();
    }

    /** When the preview of each board was made, by board. */
    public Map<UUID, Instant> findUpdatedAt(Collection<UUID> boardIds) {
        if (boardIds.isEmpty()) {
            return Map.of();
        }
        return jdbc.sql("select board_id, updated_at from boards.board_previews where board_id in (:ids)")
                .param("ids", boardIds)
                .query((rs, row) -> Map.entry(rs.getObject("board_id", UUID.class),
                        rs.getObject("updated_at", Instant.class)))
                .list().stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    /** Puts the preview in place of the board's previous one. */
    public void save(UUID boardId, Preview preview) {
        jdbc.sql("delete from boards.board_previews where board_id = :id").param("id", boardId).update();
        jdbc.sql("""
                insert into boards.board_previews (board_id, file_key, size, updated_at)
                values (:id, :key, :size, :updatedAt)
                """)
                .param("id", boardId).param("key", preview.key()).param("size", preview.size())
                .param("updatedAt", preview.updatedAt()).update();
    }
}

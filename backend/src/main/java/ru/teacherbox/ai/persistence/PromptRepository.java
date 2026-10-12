package ru.teacherbox.ai.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.ai.domain.HomeworkKind;
import ru.teacherbox.ai.domain.SavedPrompt;

@Repository
public class PromptRepository {

    private static final String SELECT =
            "select id, title, text, kind, created_at, updated_at, version from ai.prompts";

    private final JdbcClient jdbc;

    public PromptRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(SavedPrompt prompt) {
        jdbc.sql("""
                insert into ai.prompts (id, title, text, kind, created_at, updated_at, version)
                values (:id, :title, :text, :kind, :createdAt, :updatedAt, :version)
                """)
                .param("id", prompt.id())
                .param("title", prompt.title())
                .param("text", prompt.text())
                .param("kind", kindName(prompt))
                .param("createdAt", prompt.createdAt())
                .param("updatedAt", prompt.updatedAt())
                .param("version", prompt.version())
                .update();
    }

    public void update(SavedPrompt prompt) {
        int updated = jdbc.sql("""
                update ai.prompts
                set title = :title, text = :text, kind = :kind, updated_at = :updatedAt, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", prompt.id())
                .param("version", prompt.version())
                .param("title", prompt.title())
                .param("text", prompt.text())
                .param("kind", kindName(prompt))
                .param("updatedAt", prompt.updatedAt())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Prompt " + prompt.id() + " was modified");
        }
        prompt.markSaved(prompt.version() + 1);
    }

    /** @return whether there was such a prompt */
    public boolean delete(UUID id) {
        return jdbc.sql("delete from ai.prompts where id = :id").param("id", id).update() == 1;
    }

    public Optional<SavedPrompt> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(PromptRepository::map).optional();
    }

    /** By title. */
    public List<SavedPrompt> findAll() {
        return jdbc.sql(SELECT + " order by lower(title), created_at").query(PromptRepository::map).list();
    }

    private static String kindName(SavedPrompt prompt) {
        HomeworkKind kind = prompt.kind();
        return kind == null ? null : kind.name();
    }

    private static SavedPrompt map(ResultSet rs, int rowNum) throws SQLException {
        String kind = rs.getString("kind");
        return SavedPrompt.restore(
                rs.getObject("id", UUID.class),
                rs.getString("title"),
                rs.getString("text"),
                kind == null ? null : HomeworkKind.valueOf(kind),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}

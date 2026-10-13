package ru.teacherbox.ai.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.ai.domain.AiFeature;

/** System prompts the teacher rewrote; a feature without a row uses the default one. */
@Repository
public class SystemPromptRepository {

    /** The teacher's system prompt of a feature. */
    public record StoredPrompt(AiFeature feature, String text, Instant updatedAt, long version) {
    }

    private final JdbcClient jdbc;

    public SystemPromptRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<StoredPrompt> find(AiFeature feature) {
        return jdbc.sql("select feature, text, updated_at, version from ai.system_prompts where feature = :feature")
                .param("feature", feature.name())
                .query(SystemPromptRepository::map)
                .optional();
    }

    /**
     * Saves the text with the next version.
     *
     * @param expectedVersion {@code 0} when the feature still has the default prompt
     * @throws OptimisticLockingFailureException if the prompt was changed after {@code expectedVersion}
     */
    public StoredPrompt save(AiFeature feature, String text, Instant now, long expectedVersion) {
        if (expectedVersion == 0) {
            try {
                jdbc.sql("""
                        insert into ai.system_prompts (feature, text, updated_at, version)
                        values (:feature, :text, :updatedAt, 1)
                        """)
                        .param("feature", feature.name())
                        .param("text", text)
                        .param("updatedAt", now)
                        .update();
            } catch (DuplicateKeyException e) {
                throw new OptimisticLockingFailureException("System prompt " + feature + " was modified", e);
            }
        } else {
            int updated = jdbc.sql("""
                    update ai.system_prompts set text = :text, updated_at = :updatedAt, version = version + 1
                    where feature = :feature and version = :version
                    """)
                    .param("feature", feature.name())
                    .param("version", expectedVersion)
                    .param("text", text)
                    .param("updatedAt", now)
                    .update();
            if (updated != 1) {
                throw new OptimisticLockingFailureException("System prompt " + feature + " was modified");
            }
        }
        return new StoredPrompt(feature, text, now, expectedVersion + 1);
    }

    public void delete(AiFeature feature) {
        jdbc.sql("delete from ai.system_prompts where feature = :feature").param("feature", feature.name()).update();
    }

    private static StoredPrompt map(ResultSet rs, int rowNum) throws SQLException {
        return new StoredPrompt(
                AiFeature.valueOf(rs.getString("feature")),
                rs.getString("text"),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}

package ru.teacherbox.ai.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.AiSettings;
import ru.teacherbox.ai.domain.ProviderKind;

/** The AI providers, their models and the teacher's AI settings (ADR-0057). */
@Repository
public class ProviderRepository {

    private static final String PROVIDER_COLUMNS = "id, kind, name, api_key, base_url, proxy, position, version";
    private static final String MODEL_COLUMNS =
            "id, provider_id, model_id, label, effort, fallbacks, max_tokens, timeout_seconds, position, version";

    private final JdbcClient jdbc;

    public ProviderRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Stores a new provider; its version is the one given (normally 0). */
    public void insert(AiProvider provider, Instant now) {
        jdbc.sql("""
                insert into ai.providers (id, kind, name, api_key, base_url, proxy, position, created_at,
                    updated_at, version)
                values (:id, :kind, :name, :apiKey, :baseUrl, :proxy, :position, :now, :now, :version)
                """)
                .param("id", provider.id())
                .param("kind", provider.kind().id())
                .param("name", provider.name())
                .param("apiKey", provider.apiKey())
                .param("baseUrl", provider.baseUrl())
                .param("proxy", provider.proxy())
                .param("position", provider.position())
                .param("now", now)
                .param("version", provider.version())
                .update();
    }

    /**
     * Saves the provider's fields with the next version.
     *
     * @throws OptimisticLockingFailureException if it was changed or removed after {@code provider.version()}
     */
    public AiProvider update(AiProvider provider, Instant now) {
        int updated = jdbc.sql("""
                update ai.providers set name = :name, api_key = :apiKey, base_url = :baseUrl, proxy = :proxy,
                    position = :position, updated_at = :now, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", provider.id())
                .param("name", provider.name())
                .param("apiKey", provider.apiKey())
                .param("baseUrl", provider.baseUrl())
                .param("proxy", provider.proxy())
                .param("position", provider.position())
                .param("now", now)
                .param("version", provider.version())
                .update();
        if (updated == 0) {
            throw new OptimisticLockingFailureException("The AI provider was changed or removed");
        }
        return new AiProvider(provider.id(), provider.kind(), provider.name(), provider.apiKey(), provider.baseUrl(),
                provider.proxy(), provider.position(), provider.version() + 1);
    }

    public Optional<AiProvider> findProvider(UUID id) {
        return jdbc.sql("select " + PROVIDER_COLUMNS + " from ai.providers where id = :id")
                .param("id", id)
                .query(ProviderRepository::provider)
                .optional();
    }

    /** By position. */
    public List<AiProvider> providers() {
        return jdbc.sql("select " + PROVIDER_COLUMNS + " from ai.providers order by position, created_at, id")
                .query(ProviderRepository::provider)
                .list();
    }

    /** Removes the provider with its models; the default model, if it was one of them, is unset. */
    public boolean deleteProvider(UUID id) {
        return jdbc.sql("delete from ai.providers where id = :id").param("id", id).update() > 0;
    }

    public void insert(AiModel model) {
        jdbc.sql("""
                insert into ai.models (id, provider_id, model_id, label, effort, fallbacks, max_tokens,
                    timeout_seconds, position, version)
                values (:id, :providerId, :modelId, :label, :effort, :fallbacks, :maxTokens, :timeout, :position,
                    :version)
                """)
                .param("id", model.id())
                .param("providerId", model.providerId())
                .param("modelId", model.modelId())
                .param("label", model.label())
                .param("effort", model.effort())
                .param("fallbacks", model.fallbacks())
                .param("maxTokens", model.maxTokens())
                .param("timeout", model.timeout().toSeconds())
                .param("position", model.position())
                .param("version", model.version())
                .update();
    }

    /**
     * Saves the model's fields with the next version.
     *
     * @throws OptimisticLockingFailureException if it was changed or removed after {@code model.version()}
     */
    public AiModel update(AiModel model) {
        int updated = jdbc.sql("""
                update ai.models set model_id = :modelId, label = :label, effort = :effort, fallbacks = :fallbacks,
                    max_tokens = :maxTokens, timeout_seconds = :timeout, position = :position, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", model.id())
                .param("modelId", model.modelId())
                .param("label", model.label())
                .param("effort", model.effort())
                .param("fallbacks", model.fallbacks())
                .param("maxTokens", model.maxTokens())
                .param("timeout", model.timeout().toSeconds())
                .param("position", model.position())
                .param("version", model.version())
                .update();
        if (updated == 0) {
            throw new OptimisticLockingFailureException("The AI model was changed or removed");
        }
        return new AiModel(model.id(), model.providerId(), model.modelId(), model.label(), model.effort(),
                model.fallbacks(), model.maxTokens(), model.timeout(), model.position(), model.version() + 1);
    }

    public Optional<AiModel> findModel(UUID id) {
        return jdbc.sql("select " + MODEL_COLUMNS + " from ai.models where id = :id")
                .param("id", id)
                .query(ProviderRepository::model)
                .optional();
    }

    /** The provider's models by position. */
    public List<AiModel> models(UUID providerId) {
        return jdbc.sql("select " + MODEL_COLUMNS + " from ai.models where provider_id = :providerId"
                        + " order by position, id")
                .param("providerId", providerId)
                .query(ProviderRepository::model)
                .list();
    }

    public boolean deleteModel(UUID id) {
        return jdbc.sql("delete from ai.models where id = :id").param("id", id).update() > 0;
    }

    /** The settings, {@link AiSettings#NONE} while nothing is stored. */
    public AiSettings settings() {
        return jdbc.sql("select default_model_id, monthly_token_limit, version from ai.settings where id = 1")
                .query((rs, rowNum) -> new AiSettings(rs.getObject("default_model_id", UUID.class),
                        rs.getLong("monthly_token_limit"), rs.getLong("version")))
                .optional()
                .orElse(AiSettings.NONE);
    }

    /**
     * Stores the settings with the next version.
     *
     * @throws OptimisticLockingFailureException if they were changed after {@code expectedVersion} ({@code 0}
     *                                           while nothing is stored)
     */
    public AiSettings saveSettings(@Nullable UUID defaultModelId, long monthlyTokenLimit, long expectedVersion) {
        int saved = expectedVersion == 0
                ? jdbc.sql("""
                        insert into ai.settings (id, default_model_id, monthly_token_limit, version)
                        select 1, :model, :limit, 1 where not exists (select 1 from ai.settings where id = 1)
                        """)
                        .param("model", defaultModelId)
                        .param("limit", monthlyTokenLimit)
                        .update()
                : jdbc.sql("""
                        update ai.settings set default_model_id = :model, monthly_token_limit = :limit,
                            version = version + 1
                        where id = 1 and version = :version
                        """)
                        .param("model", defaultModelId)
                        .param("limit", monthlyTokenLimit)
                        .param("version", expectedVersion)
                        .update();
        if (saved == 0) {
            throw new OptimisticLockingFailureException("The AI settings were changed");
        }
        return new AiSettings(defaultModelId, monthlyTokenLimit, expectedVersion + 1);
    }

    private static AiProvider provider(ResultSet rs, int rowNum) throws SQLException {
        String kind = rs.getString("kind");
        return new AiProvider(
                rs.getObject("id", UUID.class),
                ProviderKind.of(kind).orElseThrow(() -> new IllegalStateException("Unknown provider kind " + kind)),
                rs.getString("name"),
                rs.getString("api_key"),
                rs.getString("base_url"),
                rs.getString("proxy"),
                rs.getInt("position"),
                rs.getLong("version"));
    }

    private static AiModel model(ResultSet rs, int rowNum) throws SQLException {
        return new AiModel(
                rs.getObject("id", UUID.class),
                rs.getObject("provider_id", UUID.class),
                rs.getString("model_id"),
                rs.getString("label"),
                rs.getString("effort"),
                rs.getBoolean("fallbacks"),
                rs.getLong("max_tokens"),
                Duration.ofSeconds(rs.getInt("timeout_seconds")),
                rs.getInt("position"),
                rs.getLong("version"));
    }
}

package ru.teacherbox.ai;

import java.time.Duration;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.ProviderKind;

/** Providers and models for tests (ADR-0057). */
public final class AiFixtures {

    private AiFixtures() {
    }

    public static AiProvider provider(ProviderKind kind, @Nullable String apiKey, @Nullable String baseUrl) {
        return provider(kind, apiKey, baseUrl, null);
    }

    public static AiProvider provider(ProviderKind kind, @Nullable String apiKey, @Nullable String baseUrl,
            @Nullable String proxy) {
        return new AiProvider(UUID.randomUUID(), kind, kind.title(), apiKey, baseUrl, proxy, 0, 0);
    }

    public static AiModel model(AiProvider provider, String modelId) {
        return model(provider, modelId, null, true);
    }

    public static AiModel model(AiProvider provider, String modelId, @Nullable String effort, boolean fallbacks) {
        return new AiModel(UUID.randomUUID(), provider.id(), modelId, AiModel.labelOf(modelId), effort, fallbacks,
                16_000, Duration.ofSeconds(30), 0, 0);
    }
}

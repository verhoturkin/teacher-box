package ru.teacherbox.ai.gemini;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import ru.teacherbox.ai.application.LlmAdapter;
import ru.teacherbox.ai.application.LlmClient;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.ProviderKind;
import ru.teacherbox.ai.openai.OpenAiCompatibleLlmClient;
import ru.teacherbox.shared.http.OutboundProxy;

/**
 * Gemini through its OpenAI-compatible endpoint, which accepts the same JSON-schema answer format as the other
 * providers. A consumer Google AI Pro subscription cannot be used: the Gemini API is billed separately (ADR-0006).
 */
@Component
class GeminiAdapter implements LlmAdapter {

    private final RestClient.Builder builder;

    GeminiAdapter(RestClient.Builder builder) {
        this.builder = builder;
    }

    @Override
    public ProviderKind kind() {
        return ProviderKind.GEMINI;
    }

    @Override
    public LlmClient create(AiProvider provider, AiModel model, @Nullable OutboundProxy proxy) {
        String address = Objects.requireNonNull(provider.address(), "API address");
        return new OpenAiCompatibleLlmClient(
                OpenAiCompatibleLlmClient.http(builder, address, provider.apiKey(), model.timeout(), proxy),
                ProviderKind.GEMINI.id(), model.modelId());
    }
}

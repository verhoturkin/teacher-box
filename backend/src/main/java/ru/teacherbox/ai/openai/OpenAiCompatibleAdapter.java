package ru.teacherbox.ai.openai;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import ru.teacherbox.ai.application.LlmAdapter;
import ru.teacherbox.ai.application.LlmClient;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.ProviderKind;
import ru.teacherbox.shared.http.OutboundProxy;

/** Any {@code /chat/completions} API at the provider's address (OpenAI, Ollama, LM Studio, vLLM). */
@Component
class OpenAiCompatibleAdapter implements LlmAdapter {

    private final RestClient.Builder builder;

    OpenAiCompatibleAdapter(RestClient.Builder builder) {
        this.builder = builder;
    }

    @Override
    public ProviderKind kind() {
        return ProviderKind.OPENAI_COMPATIBLE;
    }

    @Override
    public LlmClient create(AiProvider provider, AiModel model, @Nullable OutboundProxy proxy) {
        String address = Objects.requireNonNull(provider.address(), "API address");
        return new OpenAiCompatibleLlmClient(
                OpenAiCompatibleLlmClient.http(builder, address, provider.apiKey(), model.timeout(), proxy),
                ProviderKind.OPENAI_COMPATIBLE.id(), model.modelId());
    }
}

package ru.teacherbox.ai.deepseek;

import java.util.Map;
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
import ru.teacherbox.ai.openai.OpenAiCompatibleLlmClient.AnswerFormat;
import ru.teacherbox.shared.http.OutboundProxy;

/**
 * The DeepSeek API is OpenAI-compatible but takes no JSON schema in {@code response_format} — only
 * {@code json_object}, with the expected JSON described in the prompt.
 */
@Component
class DeepSeekAdapter implements LlmAdapter {

    private final RestClient.Builder builder;

    DeepSeekAdapter(RestClient.Builder builder) {
        this.builder = builder;
    }

    @Override
    public ProviderKind kind() {
        return ProviderKind.DEEPSEEK;
    }

    @Override
    public LlmClient create(AiProvider provider, AiModel model, @Nullable OutboundProxy proxy) {
        String address = Objects.requireNonNull(provider.address(), "API address");
        return new OpenAiCompatibleLlmClient(
                OpenAiCompatibleLlmClient.http(builder, address, provider.apiKey(), model.timeout(), proxy),
                ProviderKind.DEEPSEEK.id(), model.modelId(), AnswerFormat.JSON_OBJECT, Map.of());
    }
}

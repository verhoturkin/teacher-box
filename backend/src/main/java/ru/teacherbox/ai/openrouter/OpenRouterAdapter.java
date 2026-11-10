package ru.teacherbox.ai.openrouter;

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
import ru.teacherbox.shared.http.OutboundProxy;

/**
 * OpenRouter is OpenAI-compatible; requests are routed only to the providers of a model that honour every
 * parameter — above all the JSON-schema answer format, which other providers would silently ignore. The portal
 * names itself by title only: the referer would publish the portal's address in OpenRouter's app rankings.
 */
@Component
class OpenRouterAdapter implements LlmAdapter {

    static final String TITLE_HEADER = "X-OpenRouter-Title";
    static final String TITLE = "Teacher Box";

    private final RestClient.Builder builder;

    OpenRouterAdapter(RestClient.Builder builder) {
        this.builder = builder;
    }

    @Override
    public ProviderKind kind() {
        return ProviderKind.OPENROUTER;
    }

    @Override
    public LlmClient create(AiProvider provider, AiModel model, @Nullable OutboundProxy proxy) {
        String address = Objects.requireNonNull(provider.address(), "API address");
        RestClient http = OpenAiCompatibleLlmClient.http(builder.clone().defaultHeader(TITLE_HEADER, TITLE), address,
                provider.apiKey(), model.timeout(), proxy);
        return new OpenAiCompatibleLlmClient(http, ProviderKind.OPENROUTER.id(), model.modelId(),
                Map.of("provider", Map.of("require_parameters", true)));
    }
}

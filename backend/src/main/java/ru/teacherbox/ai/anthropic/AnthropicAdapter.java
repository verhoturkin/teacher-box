package ru.teacherbox.ai.anthropic;

import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.OutputConfig;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import ru.teacherbox.ai.application.LlmAdapter;
import ru.teacherbox.ai.application.LlmClient;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.ProviderKind;
import ru.teacherbox.shared.http.OutboundProxy;

/** Claude through the official Anthropic Java SDK; the address is the SDK's unless the provider gives one. */
@Component
class AnthropicAdapter implements LlmAdapter {

    @Override
    public ProviderKind kind() {
        return ProviderKind.ANTHROPIC;
    }

    @Override
    public LlmClient create(AiProvider provider, AiModel model, @Nullable OutboundProxy proxy) {
        AnthropicOkHttpClient.Builder client = AnthropicOkHttpClient.builder()
                .apiKey(Objects.requireNonNull(provider.apiKey(), "API key"))
                .timeout(model.timeout())
                .maxRetries(1);
        if (provider.baseUrl() != null) {
            client.baseUrl(provider.baseUrl());
        }
        if (proxy != null) {
            client.proxy(proxy.toProxy());
        }
        return new AnthropicLlmClient(client.build(), model.modelId(), effort(model.effort()), model.fallbacks(),
                model.maxTokens());
    }

    static OutputConfig.@Nullable Effort effort(@Nullable String effort) {
        return effort == null ? null : OutputConfig.Effort.of(effort);
    }
}

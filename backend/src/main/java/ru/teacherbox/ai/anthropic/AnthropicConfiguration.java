package ru.teacherbox.ai.anthropic;

import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.OutputConfig;
import java.util.Locale;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.type.AnnotatedTypeMetadata;
import ru.teacherbox.ai.application.AiProperties;

/** Enabled by {@code TEACHERBOX_AI_PROVIDER=anthropic}. */
@Configuration(proxyBeanMethods = false)
@Conditional(AnthropicConfiguration.Selected.class)
class AnthropicConfiguration {

    private static final Set<String> EFFORTS = Set.of("low", "medium", "high", "xhigh", "max");

    @Bean
    AnthropicLlmClient anthropicLlmClient(AiProperties properties) {
        if (!AiProperties.hasText(properties.apiKey())) {
            throw new IllegalStateException("TEACHERBOX_AI_API_KEY is required for the anthropic provider");
        }
        AnthropicOkHttpClient.Builder client = AnthropicOkHttpClient.builder()
                .apiKey(properties.apiKey().strip())
                .timeout(properties.timeout())
                .maxRetries(1);
        if (AiProperties.hasText(properties.baseUrl())) {
            client.baseUrl(properties.baseUrl().strip());
        }
        String model = AiProperties.hasText(properties.model()) ? properties.model().strip()
                : AiProperties.DEFAULT_ANTHROPIC_MODEL;
        return new AnthropicLlmClient(client.build(), model, effort(properties.effort()), properties.fallbacks(),
                properties.maxTokens());
    }

    static OutputConfig.@Nullable Effort effort(@Nullable String value) {
        if (!AiProperties.hasText(value)) {
            return null;
        }
        String effort = value.strip().toLowerCase(Locale.ROOT);
        if (!EFFORTS.contains(effort)) {
            throw new IllegalStateException("TEACHERBOX_AI_EFFORT must be one of " + EFFORTS + ", got " + value);
        }
        return OutputConfig.Effort.of(effort);
    }

    static final class Selected implements Condition {

        @Override
        public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
            String provider = context.getEnvironment().getProperty("teacherbox.ai.provider", "");
            return AiProperties.ANTHROPIC.equals(provider.strip().toLowerCase(Locale.ROOT));
        }
    }
}

package ru.teacherbox.ai.gemini;

import java.util.Locale;
import org.jspecify.annotations.Nullable;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.web.client.RestClient;
import ru.teacherbox.ai.application.AiProperties;
import ru.teacherbox.ai.openai.OpenAiCompatibleLlmClient;

/**
 * Enabled by {@code TEACHERBOX_AI_PROVIDER=gemini}. Gemini is called through its OpenAI-compatible
 * endpoint, which accepts the same JSON-schema answer format as the other providers. A consumer
 * Google AI Pro subscription cannot be used: the Gemini API is billed separately (ADR-0006).
 */
@Configuration(proxyBeanMethods = false)
@Conditional(GeminiConfiguration.Selected.class)
class GeminiConfiguration {

    @Bean
    OpenAiCompatibleLlmClient geminiLlmClient(RestClient.Builder builder, AiProperties properties) {
        if (!AiProperties.hasText(properties.apiKey())) {
            throw new IllegalStateException("TEACHERBOX_AI_API_KEY is required for the gemini provider");
        }
        return new OpenAiCompatibleLlmClient(OpenAiCompatibleLlmClient.http(builder, properties, baseUrl(properties)),
                AiProperties.GEMINI, orDefault(properties.model(), AiProperties.DEFAULT_GEMINI_MODEL));
    }

    static String baseUrl(AiProperties properties) {
        return orDefault(properties.baseUrl(), AiProperties.GEMINI_BASE_URL);
    }

    private static String orDefault(@Nullable String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.strip();
    }

    static final class Selected implements Condition {

        @Override
        public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
            String provider = context.getEnvironment().getProperty("teacherbox.ai.provider", "");
            return AiProperties.GEMINI.equals(provider.strip().toLowerCase(Locale.ROOT));
        }
    }
}

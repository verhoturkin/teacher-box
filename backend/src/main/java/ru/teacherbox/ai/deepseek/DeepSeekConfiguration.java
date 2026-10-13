package ru.teacherbox.ai.deepseek;

import java.util.Locale;
import java.util.Map;
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
import ru.teacherbox.ai.openai.OpenAiCompatibleLlmClient.AnswerFormat;

/**
 * Enabled by {@code TEACHERBOX_AI_PROVIDER=deepseek}. The DeepSeek API is OpenAI-compatible but takes no JSON schema
 * in {@code response_format} — only {@code json_object}, with the expected JSON described in the prompt.
 */
@Configuration(proxyBeanMethods = false)
@Conditional(DeepSeekConfiguration.Selected.class)
class DeepSeekConfiguration {

    @Bean
    OpenAiCompatibleLlmClient deepSeekLlmClient(RestClient.Builder builder, AiProperties properties) {
        if (!AiProperties.hasText(properties.apiKey())) {
            throw new IllegalStateException("TEACHERBOX_AI_API_KEY is required for the deepseek provider");
        }
        return new OpenAiCompatibleLlmClient(OpenAiCompatibleLlmClient.http(builder, properties, baseUrl(properties)),
                AiProperties.DEEPSEEK, orDefault(properties.model(), AiProperties.DEFAULT_DEEPSEEK_MODEL),
                AnswerFormat.JSON_OBJECT, Map.of());
    }

    static String baseUrl(AiProperties properties) {
        return orDefault(properties.baseUrl(), AiProperties.DEEPSEEK_BASE_URL);
    }

    private static String orDefault(@Nullable String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.strip();
    }

    static final class Selected implements Condition {

        @Override
        public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
            String provider = context.getEnvironment().getProperty("teacherbox.ai.provider", "");
            return AiProperties.DEEPSEEK.equals(provider.strip().toLowerCase(Locale.ROOT));
        }
    }
}

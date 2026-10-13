package ru.teacherbox.ai.openrouter;

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

/**
 * Enabled by {@code TEACHERBOX_AI_PROVIDER=openrouter}. OpenRouter is OpenAI-compatible; requests are routed only to
 * the providers of a model that honour every parameter — above all the JSON-schema answer format, which other
 * providers would silently ignore. The portal names itself by title only: the referer would publish the portal's
 * address in OpenRouter's app rankings.
 */
@Configuration(proxyBeanMethods = false)
@Conditional(OpenRouterConfiguration.Selected.class)
class OpenRouterConfiguration {

    static final String TITLE_HEADER = "X-OpenRouter-Title";
    static final String TITLE = "Teacher Box";

    @Bean
    OpenAiCompatibleLlmClient openRouterLlmClient(RestClient.Builder builder, AiProperties properties) {
        if (!AiProperties.hasText(properties.apiKey())) {
            throw new IllegalStateException("TEACHERBOX_AI_API_KEY is required for the openrouter provider");
        }
        RestClient http = OpenAiCompatibleLlmClient.http(builder.clone().defaultHeader(TITLE_HEADER, TITLE),
                properties, baseUrl(properties));
        return new OpenAiCompatibleLlmClient(http, AiProperties.OPENROUTER,
                orDefault(properties.model(), AiProperties.DEFAULT_OPENROUTER_MODEL),
                Map.of("provider", Map.of("require_parameters", true)));
    }

    static String baseUrl(AiProperties properties) {
        return orDefault(properties.baseUrl(), AiProperties.OPENROUTER_BASE_URL);
    }

    private static String orDefault(@Nullable String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.strip();
    }

    static final class Selected implements Condition {

        @Override
        public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
            String provider = context.getEnvironment().getProperty("teacherbox.ai.provider", "");
            return AiProperties.OPENROUTER.equals(provider.strip().toLowerCase(Locale.ROOT));
        }
    }
}

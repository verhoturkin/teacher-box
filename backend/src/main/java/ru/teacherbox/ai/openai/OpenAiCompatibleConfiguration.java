package ru.teacherbox.ai.openai;

import java.util.Locale;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.web.client.RestClient;
import ru.teacherbox.ai.application.AiProperties;

/** Enabled by {@code TEACHERBOX_AI_PROVIDER=openai-compatible}. */
@Configuration(proxyBeanMethods = false)
@Conditional(OpenAiCompatibleConfiguration.Selected.class)
class OpenAiCompatibleConfiguration {

    @Bean
    OpenAiCompatibleLlmClient openAiCompatibleLlmClient(RestClient.Builder builder, AiProperties properties) {
        if (!AiProperties.hasText(properties.baseUrl())) {
            throw new IllegalStateException("TEACHERBOX_AI_BASE_URL is required for the openai-compatible provider");
        }
        if (!AiProperties.hasText(properties.model())) {
            throw new IllegalStateException("TEACHERBOX_AI_MODEL is required for the openai-compatible provider");
        }
        return new OpenAiCompatibleLlmClient(OpenAiCompatibleLlmClient.http(builder, properties, properties.baseUrl()),
                AiProperties.OPENAI_COMPATIBLE, properties.model().strip());
    }

    static final class Selected implements Condition {

        @Override
        public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
            String provider = context.getEnvironment().getProperty("teacherbox.ai.provider", "");
            return AiProperties.OPENAI_COMPATIBLE.equals(provider.strip().toLowerCase(Locale.ROOT));
        }
    }
}

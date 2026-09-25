package ru.teacherbox.ai.openai;

import java.time.Duration;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.http.HttpHeaders;
import org.springframework.web.client.RestClient;
import ru.teacherbox.ai.application.AiProperties;
import ru.teacherbox.shared.http.OutboundHttp;
import ru.teacherbox.shared.http.OutboundProxy;

/** Enabled by {@code TEACHERBOX_AI_PROVIDER=openai-compatible}. */
@Configuration(proxyBeanMethods = false)
@Conditional(OpenAiCompatibleConfiguration.Selected.class)
class OpenAiCompatibleConfiguration {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Logger log = LoggerFactory.getLogger(OpenAiCompatibleConfiguration.class);

    @Bean
    OpenAiCompatibleLlmClient openAiCompatibleLlmClient(RestClient.Builder builder, AiProperties properties) {
        if (!AiProperties.hasText(properties.baseUrl())) {
            throw new IllegalStateException("TEACHERBOX_AI_BASE_URL is required for the openai-compatible provider");
        }
        if (!AiProperties.hasText(properties.model())) {
            throw new IllegalStateException("TEACHERBOX_AI_MODEL is required for the openai-compatible provider");
        }
        OutboundProxy proxy = properties.outboundProxy();
        if (proxy != null) {
            log.info("The AI provider is reached through the proxy {}", proxy);
        }
        RestClient.Builder http = builder.clone()
                .baseUrl(properties.baseUrl().strip().replaceAll("/+$", ""))
                .requestFactory(OutboundHttp.requestFactory(CONNECT_TIMEOUT, properties.timeout(), proxy));
        if (AiProperties.hasText(properties.apiKey())) {
            http.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.apiKey().strip());
        }
        return new OpenAiCompatibleLlmClient(http.build(), properties.model().strip());
    }

    static final class Selected implements Condition {

        @Override
        public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
            String provider = context.getEnvironment().getProperty("teacherbox.ai.provider", "");
            return AiProperties.OPENAI_COMPATIBLE.equals(provider.strip().toLowerCase(Locale.ROOT));
        }
    }
}

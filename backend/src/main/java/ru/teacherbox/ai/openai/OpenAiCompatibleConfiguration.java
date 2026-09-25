package ru.teacherbox.ai.openai;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Locale;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
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
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.timeout());
        RestClient.Builder http = builder.clone()
                .baseUrl(properties.baseUrl().strip().replaceAll("/+$", ""))
                .requestFactory(new BufferingClientHttpRequestFactory(requestFactory));
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

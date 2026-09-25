package ru.teacherbox.ai.gemini;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.web.client.RestClient;
import ru.teacherbox.ai.application.AiProperties;
import ru.teacherbox.ai.application.LlmClient;
import ru.teacherbox.ai.application.LlmRequest;
import ru.teacherbox.ai.application.LlmResponse;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Gemini through a local server that imitates its OpenAI-compatible endpoint. */
class GeminiConfigurationTest {

    private static final LlmRequest REQUEST = new LlmRequest("system text", "user text", "review_draft",
            Map.of("type", "object", "required", List.of("comment")));

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(PropertiesConfiguration.class, GeminiConfiguration.class)
            .withBean(RestClient.Builder.class, RestClient::builder);
    private final AtomicReference<String> uri = new AtomicReference<>();
    private final AtomicReference<String> authorization = new AtomicReference<>();
    private final AtomicReference<String> body = new AtomicReference<>();
    private HttpServer server;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.createContext("/", exchange -> {
            uri.set(exchange.getRequestURI().toString());
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] answer = """
                    {"model": "gemini-3.8-flash",
                     "choices": [{"finish_reason": "stop", "message": {"content": "{\\"comment\\": \\"Хорошо\\"}"}}],
                     "usage": {"prompt_tokens": 50, "completion_tokens": 20}}
                    """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, answer.length);
            exchange.getResponseBody().write(answer);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void enabledByProviderWithAKey() {
        runner.run(context -> assertThat(context).doesNotHaveBean(LlmClient.class));
        runner.withPropertyValues("teacherbox.ai.provider=openai-compatible")
                .run(context -> assertThat(context).doesNotHaveBean(LlmClient.class));
        runner.withPropertyValues("teacherbox.ai.provider=gemini")
                .run(context -> assertThat(context).hasFailed().getFailure()
                        .hasRootCauseMessage("TEACHERBOX_AI_API_KEY is required for the gemini provider"));
        runner.withPropertyValues("teacherbox.ai.provider= Gemini ", "teacherbox.ai.api-key=AIza-test")
                .run(context -> {
                    LlmClient client = context.getBean(LlmClient.class);
                    assertThat(client.provider()).isEqualTo("gemini");
                    assertThat(client.model()).isEqualTo(AiProperties.DEFAULT_GEMINI_MODEL);
                });
    }

    @Test
    void defaultsToTheGeminiEndpoint() {
        runner.withPropertyValues("teacherbox.ai.provider=gemini", "teacherbox.ai.api-key=AIza-test")
                .run(context -> assertThat(GeminiConfiguration.baseUrl(context.getBean(AiProperties.class)))
                        .isEqualTo("https://generativelanguage.googleapis.com/v1beta/openai"));
    }

    @Test
    void sendsChatCompletionsWithTheKeyThroughTheProxy() {
        runner.withPropertyValues("teacherbox.ai.provider=gemini", "teacherbox.ai.api-key=AIza-test",
                        "teacherbox.ai.model=gemini-3.7-flash",
                        "teacherbox.ai.base-url=http://gemini.test/v1beta/openai/",
                        "teacherbox.ai.proxy=http://127.0.0.1:" + server.getAddress().getPort())
                .run(context -> {
                    LlmResponse response = context.getBean(LlmClient.class).complete(REQUEST);

                    assertThat(response.text()).isEqualTo("{\"comment\": \"Хорошо\"}");
                    assertThat(response.inputTokens()).isEqualTo(50);
                    assertThat(uri.get()).isEqualTo("http://gemini.test/v1beta/openai/chat/completions");
                    assertThat(authorization.get()).isEqualTo("Bearer AIza-test");
                    JsonNode request = JsonMapper.builder().build().readTree(body.get());
                    assertThat(request.path("model").asString()).isEqualTo("gemini-3.7-flash");
                    assertThat(request.path("response_format").path("type").asString()).isEqualTo("json_schema");
                });
    }

    @EnableConfigurationProperties(AiProperties.class)
    static class PropertiesConfiguration {
    }
}

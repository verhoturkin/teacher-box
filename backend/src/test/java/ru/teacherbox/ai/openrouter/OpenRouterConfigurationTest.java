package ru.teacherbox.ai.openrouter;

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
import ru.teacherbox.shared.i18n.Language;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** OpenRouter through a local server that imitates its API. */
class OpenRouterConfigurationTest {

    private static final LlmRequest REQUEST = new LlmRequest("system text", "user text", "review_draft",
            Map.of("type", "object", "required", List.of("comment")));

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(PropertiesConfiguration.class, OpenRouterConfiguration.class)
            .withBean(RestClient.Builder.class, RestClient::builder);
    private final AtomicReference<String> uri = new AtomicReference<>();
    private final AtomicReference<String> authorization = new AtomicReference<>();
    private final AtomicReference<String> title = new AtomicReference<>();
    private final AtomicReference<String> referer = new AtomicReference<>();
    private final AtomicReference<String> body = new AtomicReference<>();
    private HttpServer server;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.createContext("/", exchange -> {
            uri.set(exchange.getRequestURI().toString());
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            title.set(exchange.getRequestHeaders().getFirst("X-OpenRouter-Title"));
            referer.set(exchange.getRequestHeaders().getFirst("HTTP-Referer"));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] answer = (exchange.getRequestURI().getPath().endsWith("/models") ? """
                    {"data": [{"id": "openrouter/auto"}, {"id": "deepseek/deepseek-v4"}]}
                    """ : """
                    {"model": "deepseek/deepseek-v4",
                     "choices": [{"finish_reason": "stop", "message": {"content": "{\\"comment\\": \\"Хорошо\\"}"}}],
                     "usage": {"prompt_tokens": 50, "completion_tokens": 20}}
                    """).getBytes(StandardCharsets.UTF_8);
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
        runner.withPropertyValues("teacherbox.ai.provider=gemini")
                .run(context -> assertThat(context).doesNotHaveBean(LlmClient.class));
        runner.withPropertyValues("teacherbox.ai.provider=openrouter")
                .run(context -> assertThat(context).hasFailed().getFailure()
                        .hasRootCauseMessage("TEACHERBOX_AI_API_KEY is required for the openrouter provider"));
        runner.withPropertyValues("teacherbox.ai.provider= OpenRouter ", "teacherbox.ai.api-key=sk-or-test")
                .run(context -> {
                    LlmClient client = context.getBean(LlmClient.class);
                    assertThat(client.provider()).isEqualTo("openrouter");
                    assertThat(client.model()).isEqualTo("openrouter/auto");
                });
    }

    @Test
    void defaultsToTheOpenRouterEndpoint() {
        runner.withPropertyValues("teacherbox.ai.provider=openrouter", "teacherbox.ai.api-key=sk-or-test")
                .run(context -> assertThat(OpenRouterConfiguration.baseUrl(context.getBean(AiProperties.class)))
                        .isEqualTo("https://openrouter.ai/api/v1"));
    }

    @Test
    void routesOnlyToProvidersThatHonourTheSchema() {
        runner.withPropertyValues("teacherbox.ai.provider=openrouter", "teacherbox.ai.api-key=sk-or-test",
                        "teacherbox.ai.model=deepseek/deepseek-v4",
                        "teacherbox.ai.base-url=http://127.0.0.1:" + server.getAddress().getPort() + "/api/v1/")
                .run(context -> {
                    LlmResponse response = context.getBean(LlmClient.class).complete(REQUEST);

                    assertThat(response.text()).isEqualTo("{\"comment\": \"Хорошо\"}");
                    assertThat(response.model()).isEqualTo("deepseek/deepseek-v4");
                    assertThat(response.outputTokens()).isEqualTo(20);
                    assertThat(uri.get()).isEqualTo("/api/v1/chat/completions");
                    assertThat(authorization.get()).isEqualTo("Bearer sk-or-test");
                    assertThat(title.get()).isEqualTo("Teacher Box");
                    assertThat(referer.get()).isNull();
                    JsonNode request = JsonMapper.builder().build().readTree(body.get());
                    assertThat(request.path("model").asString()).isEqualTo("deepseek/deepseek-v4");
                    assertThat(request.path("response_format").path("type").asString()).isEqualTo("json_schema");
                    assertThat(request.path("provider").path("require_parameters").asBoolean()).isTrue();
                });
    }

    @Test
    void pingFindsTheModelAmongOpenRouterModels() {
        runner.withPropertyValues("teacherbox.ai.provider=openrouter", "teacherbox.ai.api-key=sk-or-test",
                        "teacherbox.ai.base-url=http://127.0.0.1:" + server.getAddress().getPort() + "/api/v1")
                .run(context -> {
                    assertThat(context.getBean(LlmClient.class).ping(Language.RU))
                            .isEqualTo("Модель openrouter/auto доступна");
                    assertThat(uri.get()).isEqualTo("/api/v1/models");
                    assertThat(title.get()).isEqualTo("Teacher Box");
                });
    }

    @EnableConfigurationProperties(AiProperties.class)
    static class PropertiesConfiguration {
    }
}

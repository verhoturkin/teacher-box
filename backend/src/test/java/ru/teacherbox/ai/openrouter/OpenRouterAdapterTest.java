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
import org.springframework.web.client.RestClient;
import ru.teacherbox.ai.AiFixtures;
import ru.teacherbox.ai.application.LlmClient;
import ru.teacherbox.ai.application.LlmRequest;
import ru.teacherbox.ai.application.LlmResponse;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.ProviderKind;
import ru.teacherbox.shared.i18n.Language;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** OpenRouter through a local server that imitates its API. */
class OpenRouterAdapterTest {

    private static final LlmRequest REQUEST = new LlmRequest("system text", "user text", "review_draft",
            Map.of("type", "object", "required", List.of("comment")));

    private final OpenRouterAdapter adapter = new OpenRouterAdapter(RestClient.builder());
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
    void defaultsToTheOpenRouterEndpoint() {
        AiProvider provider = AiFixtures.provider(ProviderKind.OPENROUTER, "sk-or-test", null);
        LlmClient client = adapter.create(provider, AiFixtures.model(provider, "openrouter/auto"), null);

        assertThat(adapter.kind()).isEqualTo(ProviderKind.OPENROUTER);
        assertThat(client.provider()).isEqualTo("openrouter");
        assertThat(client.model()).isEqualTo(ProviderKind.OPENROUTER.defaultModel());
        assertThat(provider.address()).isEqualTo("https://openrouter.ai/api/v1");
    }

    @Test
    void routesOnlyToProvidersThatHonourTheSchema() {
        LlmResponse response = client("deepseek/deepseek-v4", "/api/v1/").complete(REQUEST);

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
    }

    @Test
    void pingFindsTheModelAmongOpenRouterModels() {
        assertThat(client("openrouter/auto", "/api/v1").ping(Language.RU)).isEqualTo("Модель openrouter/auto доступна");
        assertThat(uri.get()).isEqualTo("/api/v1/models");
        assertThat(title.get()).isEqualTo("Teacher Box");
    }

    private LlmClient client(String model, String path) {
        AiProvider provider = AiFixtures.provider(ProviderKind.OPENROUTER, "sk-or-test",
                "http://127.0.0.1:" + server.getAddress().getPort() + path);
        return adapter.create(provider, AiFixtures.model(provider, model), null);
    }
}

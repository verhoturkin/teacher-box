package ru.teacherbox.ai.deepseek;

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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** DeepSeek through a local server that imitates its API. */
class DeepSeekAdapterTest {

    private static final LlmRequest REQUEST = new LlmRequest("system text", "user text", "review_draft",
            Map.of("type", "object", "required", List.of("comment")));

    private final DeepSeekAdapter adapter = new DeepSeekAdapter(RestClient.builder());
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
                    {"model": "deepseek-v4-pro",
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
    void defaultsToTheDeepSeekEndpoint() {
        AiProvider provider = AiFixtures.provider(ProviderKind.DEEPSEEK, "sk-test", null);
        LlmClient client = adapter.create(provider, AiFixtures.model(provider, "deepseek-flash"), null);

        assertThat(adapter.kind()).isEqualTo(ProviderKind.DEEPSEEK);
        assertThat(client.provider()).isEqualTo("deepseek");
        assertThat(client.model()).isEqualTo(ProviderKind.DEEPSEEK.defaultModel());
        assertThat(provider.address()).isEqualTo("https://api.deepseek.com");
    }

    @Test
    void asksForAJsonObjectWithTheSchemaInThePrompt() {
        AiProvider provider = AiFixtures.provider(ProviderKind.DEEPSEEK, "sk-test",
                "http://127.0.0.1:" + server.getAddress().getPort());
        LlmResponse response = adapter.create(provider, AiFixtures.model(provider, "deepseek-v4-pro"), null)
                .complete(REQUEST);

        assertThat(response.text()).isEqualTo("{\"comment\": \"Хорошо\"}");
        assertThat(response.inputTokens()).isEqualTo(50);
        assertThat(uri.get()).isEqualTo("/chat/completions");
        assertThat(authorization.get()).isEqualTo("Bearer sk-test");
        JsonNode request = JsonMapper.builder().build().readTree(body.get());
        assertThat(request.path("model").asString()).isEqualTo("deepseek-v4-pro");
        assertThat(request.path("response_format").path("type").asString()).isEqualTo("json_object");
        assertThat(request.path("messages").path(0).path("content").asString())
                .startsWith("system text").contains("JSON Schema", "\"required\":[\"comment\"]");
    }
}

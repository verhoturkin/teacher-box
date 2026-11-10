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
import org.springframework.web.client.RestClient;
import ru.teacherbox.ai.AiFixtures;
import ru.teacherbox.ai.application.LlmClient;
import ru.teacherbox.ai.application.LlmRequest;
import ru.teacherbox.ai.application.LlmResponse;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.ProviderKind;
import ru.teacherbox.shared.http.OutboundProxy;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Gemini through a local server that imitates its OpenAI-compatible endpoint. */
class GeminiAdapterTest {

    private static final LlmRequest REQUEST = new LlmRequest("system text", "user text", "review_draft",
            Map.of("type", "object", "required", List.of("comment")));

    private final GeminiAdapter adapter = new GeminiAdapter(RestClient.builder());
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
    void defaultsToTheGeminiEndpointAndModel() {
        AiProvider provider = AiFixtures.provider(ProviderKind.GEMINI, "AIza-test", null);
        LlmClient client = adapter.create(provider, AiFixtures.model(provider, "gemini-3.8-flash"), null);

        assertThat(adapter.kind()).isEqualTo(ProviderKind.GEMINI);
        assertThat(client.provider()).isEqualTo("gemini");
        assertThat(client.model()).isEqualTo(ProviderKind.GEMINI.defaultModel());
        assertThat(provider.address()).isEqualTo("https://generativelanguage.googleapis.com/v1beta/openai");
    }

    @Test
    void sendsChatCompletionsWithTheKeyThroughTheProxy() {
        AiProvider provider = AiFixtures.provider(ProviderKind.GEMINI, "AIza-test", "http://gemini.test/v1beta/openai/");
        LlmClient client = adapter.create(provider, AiFixtures.model(provider, "gemini-3.7-flash"),
                OutboundProxy.parse("http://127.0.0.1:" + server.getAddress().getPort()));

        LlmResponse response = client.complete(REQUEST);

        assertThat(response.text()).isEqualTo("{\"comment\": \"Хорошо\"}");
        assertThat(response.inputTokens()).isEqualTo(50);
        assertThat(uri.get()).isEqualTo("http://gemini.test/v1beta/openai/chat/completions");
        assertThat(authorization.get()).isEqualTo("Bearer AIza-test");
        JsonNode request = JsonMapper.builder().build().readTree(body.get());
        assertThat(request.path("model").asString()).isEqualTo("gemini-3.7-flash");
        assertThat(request.path("response_format").path("type").asString()).isEqualTo("json_schema");
    }
}

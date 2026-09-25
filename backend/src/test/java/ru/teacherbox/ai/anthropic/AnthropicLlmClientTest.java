package ru.teacherbox.ai.anthropic;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.OutputConfig;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import ru.teacherbox.ai.application.LlmException;
import ru.teacherbox.ai.application.LlmRequest;
import ru.teacherbox.ai.application.LlmResponse;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** The adapter against a local server that imitates the Messages API (no real network calls). */
class AnthropicLlmClientTest {

    private static final LlmRequest REQUEST = new LlmRequest("system text", "user text", "homework_draft",
            Map.of("type", "object", "properties", Map.of("title", Map.of("type", "string")),
                    "required", List.of("title"), "additionalProperties", false));

    private final JsonMapper json = JsonMapper.builder().build();
    private final AtomicReference<String> requestBody = new AtomicReference<>();
    private final AtomicReference<String> apiKey = new AtomicReference<>();
    private final AtomicReference<String> beta = new AtomicReference<>();
    private final AtomicReference<String> uri = new AtomicReference<>();
    private final AtomicReference<Integer> status = new AtomicReference<>(200);
    private final AtomicReference<String> responseBody = new AtomicReference<>();
    private HttpServer server;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/messages", exchange -> {
            uri.set(exchange.getRequestURI().toString());
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            apiKey.set(exchange.getRequestHeaders().getFirst("x-api-key"));
            beta.set(exchange.getRequestHeaders().getFirst("anthropic-beta"));
            byte[] body = responseBody.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status.get(), body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void sendsStructuredOutputRequestWithFallbacksAndReadsTheText() {
        respond(200, message("end_turn", """
                {"type": "thinking", "thinking": "", "signature": "sig"},
                {"type": "text", "text": "{\\"title\\": "},
                {"type": "text", "text": "\\"Дроби\\"}"}
                """));

        LlmResponse response;
        try (AnthropicLlmClient client = client(OutputConfig.Effort.HIGH, true)) {
            response = client.complete(REQUEST);
            assertThat(client.provider()).isEqualTo("anthropic");
            assertThat(client.model()).isEqualTo("claude-opus-5");
        }

        assertThat(response).isEqualTo(new LlmResponse("{\"title\": \"Дроби\"}", "claude-opus-5", 120, 340));
        assertThat(apiKey.get()).isEqualTo("test-key");
        assertThat(beta.get()).contains(AnthropicLlmClient.FALLBACK_BETA);
        JsonNode body = json.readTree(requestBody.get());
        assertThat(body.path("model").asString()).isEqualTo("claude-opus-5");
        assertThat(body.path("max_tokens").asLong()).isEqualTo(16000);
        assertThat(body.path("system").asString()).isEqualTo("system text");
        assertThat(body.path("messages").path(0).path("role").asString()).isEqualTo("user");
        assertThat(body.path("messages").path(0).path("content").asString()).isEqualTo("user text");
        assertThat(body.path("output_config").path("effort").asString()).isEqualTo("high");
        assertThat(body.path("output_config").path("format").path("type").asString()).isEqualTo("json_schema");
        assertThat(body.path("output_config").path("format").path("schema").path("required").path(0).asString())
                .isEqualTo("title");
        assertThat(body.path("fallbacks").asString()).isEqualTo("default");
        assertThat(body.has("thinking")).as("the default model thinks adaptively on its own").isFalse();
    }

    @Test
    void canRunWithoutEffortAndFallbacks() {
        respond(200, message("end_turn", "{\"type\": \"text\", \"text\": \"{}\"}"));

        try (AnthropicLlmClient client = client(null, false)) {
            client.complete(REQUEST);
        }

        JsonNode body = json.readTree(requestBody.get());
        assertThat(body.path("output_config").has("effort")).isFalse();
        assertThat(body.has("fallbacks")).isFalse();
        assertThat(beta.get()).isNull();
    }

    @Test
    void refusalIsReportedBeforeReadingContent() {
        respond(200, message("refusal", ""));

        try (AnthropicLlmClient client = client(null, true)) {
            assertThatThrownBy(() -> client.complete(REQUEST))
                    .isInstanceOfSatisfying(LlmException.class, e -> {
                        assertThat(e.reason()).isEqualTo(LlmException.Reason.REFUSED);
                        assertThat(e.inputTokens()).isEqualTo(120);
                    });
        }
    }

    @Test
    void truncatedAnswerIsAnError() {
        respond(200, message("max_tokens", "{\"type\": \"text\", \"text\": \"{\\\"title\\\": \\\"Др\"}"));

        try (AnthropicLlmClient client = client(null, true)) {
            assertThatThrownBy(() -> client.complete(REQUEST))
                    .isInstanceOfSatisfying(LlmException.class, e -> {
                        assertThat(e.reason()).isEqualTo(LlmException.Reason.TRUNCATED);
                        assertThat(e.outputTokens()).isEqualTo(340);
                    });
        }
    }

    @Test
    void apiErrorsMakeTheProviderUnavailable() {
        respond(529, """
                {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}
                """);

        try (AnthropicLlmClient client = client(null, true)) {
            assertThatThrownBy(() -> client.complete(REQUEST))
                    .isInstanceOfSatisfying(LlmException.class, e -> {
                        assertThat(e.reason()).isEqualTo(LlmException.Reason.UNAVAILABLE);
                        assertThat(e.getMessage()).contains("529");
                    });
        }
    }

    @Test
    void networkErrorsMakeTheProviderUnavailable() throws IOException {
        int closedPort;
        try (ServerSocket socket = new ServerSocket(0)) {
            closedPort = socket.getLocalPort();
        }
        AnthropicLlmClient client = new AnthropicLlmClient(AnthropicOkHttpClient.builder()
                .apiKey("test-key").baseUrl("http://127.0.0.1:" + closedPort).maxRetries(0).build(),
                "claude-opus-5", null, true, 16000);

        try (client) {
            assertThatThrownBy(() -> client.complete(REQUEST))
                    .isInstanceOfSatisfying(LlmException.class,
                            e -> assertThat(e.reason()).isEqualTo(LlmException.Reason.UNAVAILABLE));
        }
    }

    @Test
    void goesThroughTheConfiguredProxy() {
        respond(200, message("end_turn", "{\"type\": \"text\", \"text\": \"{}\"}"));
        ApplicationContextRunner runner = new ApplicationContextRunner()
                .withUserConfiguration(AnthropicConfigurationTest.PropertiesConfiguration.class,
                        AnthropicConfiguration.class)
                .withPropertyValues("teacherbox.ai.provider=anthropic", "teacherbox.ai.api-key=test-key",
                        "teacherbox.ai.base-url=http://api.anthropic.test",
                        "teacherbox.ai.proxy=http://127.0.0.1:" + server.getAddress().getPort());

        runner.run(context -> {
            LlmResponse response = context.getBean(AnthropicLlmClient.class).complete(REQUEST);

            assertThat(response.text()).isEqualTo("{}");
            assertThat(uri.get()).as("the proxy gets the full target address")
                    .isEqualTo("http://api.anthropic.test/v1/messages");
            assertThat(apiKey.get()).isEqualTo("test-key");
        });
        runner.withPropertyValues("teacherbox.ai.proxy=socks5://user:secret@vpn:1080")
                .run(context -> assertThat(context).hasFailed().getFailure()
                        .hasRootCauseMessage("Proxies with a login and password are not supported; "
                                + "use a proxy without authentication that listens on a private address"));
    }

    private AnthropicLlmClient client(OutputConfig.Effort effort, boolean fallbacks) {
        return new AnthropicLlmClient(AnthropicOkHttpClient.builder()
                .apiKey("test-key")
                .baseUrl("http://127.0.0.1:" + server.getAddress().getPort())
                .maxRetries(0)
                .build(), "claude-opus-5", effort, fallbacks, 16000);
    }

    private void respond(int httpStatus, String body) {
        status.set(httpStatus);
        responseBody.set(body);
    }

    private static String message(String stopReason, String content) {
        return """
                {"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-opus-5",
                 "content": [%s], "stop_reason": "%s", "stop_sequence": null,
                 "usage": {"input_tokens": 120, "output_tokens": 340}}
                """.formatted(content, stopReason);
    }
}

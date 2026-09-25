package ru.teacherbox.notifications.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

/** The messenger HTTP client against a real local server. */
class MessengerHttpTest {

    private final AtomicReference<String> contentLength = new AtomicReference<>();
    private final AtomicReference<String> transferEncoding = new AtomicReference<>();
    private final AtomicReference<String> protocol = new AtomicReference<>();
    private HttpServer server;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/echo", exchange -> {
            contentLength.set(exchange.getRequestHeaders().getFirst("Content-Length"));
            transferEncoding.set(exchange.getRequestHeaders().getFirst("Transfer-Encoding"));
            protocol.set(exchange.getProtocol());
            byte[] body = exchange.getRequestBody().readAllBytes();
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
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
    void sendsBodiesWithContentLengthOverHttp11() {
        RestClient client = MessengerHttp.client(RestClient.builder(),
                "http://127.0.0.1:" + server.getAddress().getPort());

        String echoed = client.post()
                .uri("/echo")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("text", "Привет"))
                .retrieve()
                .body(String.class);

        assertThat(echoed).isEqualTo("{\"text\":\"Привет\"}");
        assertThat(contentLength.get())
                .isEqualTo(String.valueOf("{\"text\":\"Привет\"}".getBytes(StandardCharsets.UTF_8).length));
        assertThat(transferEncoding.get()).isNull();
        assertThat(protocol.get()).isEqualTo("HTTP/1.1");
    }

    @Test
    void redactsSecretsFromErrors() {
        assertThat(MessengerHttp.redact("I/O error on https://api/bot123:SECRET/getMe", "123:SECRET"))
                .isEqualTo("I/O error on https://api/bot***/getMe");
        assertThat(MessengerHttp.redact(null, "x")).isEqualTo("unknown error");
        assertThat(MessengerHttp.redact("text", null)).isEqualTo("text");
        assertThat(MessengerHttp.redact("text", "")).isEqualTo("text");
    }
}

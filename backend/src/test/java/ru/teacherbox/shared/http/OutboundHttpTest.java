package ru.teacherbox.shared.http;

import static java.nio.charset.StandardCharsets.US_ASCII;
import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/** Calls through local HTTP and SOCKS5 proxies that answer in place of the target server. */
class OutboundHttpTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final String BODY = "{\"text\":\"Привет\"}";

    @Test
    void httpProxyGetsTheFullTargetAddress() throws IOException {
        AtomicReference<String> uri = new AtomicReference<>();
        AtomicReference<String> contentLength = new AtomicReference<>();
        HttpServer proxy = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        proxy.createContext("/", exchange -> {
            uri.set(exchange.getRequestURI().toString());
            contentLength.set(exchange.getRequestHeaders().getFirst("Content-Length"));
            byte[] body = exchange.getRequestBody().readAllBytes();
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        proxy.start();
        try {
            String echoed = post(new OutboundProxy(OutboundProxy.Type.HTTP, "127.0.0.1",
                    proxy.getAddress().getPort()));

            assertThat(echoed).isEqualTo(BODY);
            assertThat(uri.get()).isEqualTo("http://teacherbox.test/echo");
            assertThat(contentLength.get()).isEqualTo(String.valueOf(BODY.getBytes(UTF_8).length));
        } finally {
            proxy.stop(0);
        }
    }

    @Test
    void socksProxyConnectsToTheTargetHost() throws IOException {
        try (Socks5Server proxy = new Socks5Server()) {
            String answer = post(new OutboundProxy(OutboundProxy.Type.SOCKS, "localhost", proxy.port()));

            assertThat(answer).isEqualTo("{\"via\":\"socks\"}");
            assertThat(proxy.target.get()).endsWith(":80");
            assertThat(proxy.head.get()).startsWith("POST /echo HTTP/1.1")
                    .containsIgnoringCase("host: teacherbox.test")
                    .containsIgnoringCase("content-length: " + BODY.getBytes(UTF_8).length);
            assertThat(proxy.body.get()).isEqualTo(BODY);
        }
    }

    @Test
    void unreachableProxyIsAnIoError() throws IOException {
        int closedPort;
        try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            closedPort = socket.getLocalPort();
        }

        assertThatThrownBy(() -> post(new OutboundProxy(OutboundProxy.Type.SOCKS, "127.0.0.1", closedPort)))
                .isInstanceOf(ResourceAccessException.class);
    }

    private static String post(OutboundProxy proxy) {
        RestClient client = RestClient.builder()
                .baseUrl("http://teacherbox.test")
                .requestFactory(OutboundHttp.requestFactory(TIMEOUT, TIMEOUT, proxy))
                .build();
        return client.post()
                .uri("/echo")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("text", "Привет"))
                .retrieve()
                .body(String.class);
    }

    /** A SOCKS5 server (no authentication) that answers the tunnelled HTTP request itself. */
    private static final class Socks5Server implements AutoCloseable {

        final AtomicReference<String> target = new AtomicReference<>();
        final AtomicReference<String> head = new AtomicReference<>();
        final AtomicReference<String> body = new AtomicReference<>();
        private final ServerSocket server;

        Socks5Server() throws IOException {
            server = new ServerSocket(0, 50, InetAddress.getLoopbackAddress());
            Thread.ofVirtual().start(this::serve);
        }

        int port() {
            return server.getLocalPort();
        }

        private void serve() {
            while (!server.isClosed()) {
                try (Socket socket = server.accept()) {
                    handle(new DataInputStream(socket.getInputStream()), socket.getOutputStream());
                } catch (IOException e) {
                    // closed by the test
                }
            }
        }

        private void handle(DataInputStream in, OutputStream out) throws IOException {
            in.readUnsignedByte();
            in.readNBytes(in.readUnsignedByte());
            out.write(new byte[] {5, 0});
            in.readNBytes(3);
            int addressType = in.readUnsignedByte();
            String host = switch (addressType) {
                case 1 -> InetAddress.getByAddress(in.readNBytes(4)).getHostAddress();
                case 3 -> new String(in.readNBytes(in.readUnsignedByte()), US_ASCII);
                case 4 -> InetAddress.getByAddress(in.readNBytes(16)).getHostAddress();
                default -> throw new IOException("Unknown address type " + addressType);
            };
            target.set(host + ":" + in.readUnsignedShort());
            out.write(new byte[] {5, 0, 0, 1, 0, 0, 0, 0, 0, 0});

            ByteArrayOutputStream headBytes = new ByteArrayOutputStream();
            while (!headBytes.toString(US_ASCII).endsWith("\r\n\r\n")) {
                headBytes.write(in.readUnsignedByte());
            }
            String requestHead = headBytes.toString(US_ASCII);
            head.set(requestHead);
            int length = requestHead.lines()
                    .filter(line -> line.toLowerCase(Locale.ROOT).startsWith("content-length:"))
                    .mapToInt(line -> Integer.parseInt(line.substring(line.indexOf(':') + 1).strip()))
                    .findFirst()
                    .orElse(0);
            body.set(new String(in.readNBytes(length), UTF_8));

            byte[] answer = "{\"via\":\"socks\"}".getBytes(UTF_8);
            out.write(("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: " + answer.length
                    + "\r\nConnection: close\r\n\r\n").getBytes(US_ASCII));
            out.write(answer);
            out.flush();
        }

        @Override
        public void close() throws IOException {
            server.close();
        }
    }
}

package ru.teacherbox.shared.http;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** A proxy the administrator changes is in force for the next request (ADR-0056). */
class LiveProxyRequestFactoryTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final String NAME = "TEACHERBOX_HOMEWORK_YOUTUBE_PROXY";

    private final AtomicReference<@Nullable String> setting = new AtomicReference<>();

    @Test
    void theNextRequestGoesThroughTheNewProxy() throws IOException {
        AtomicReference<String> direct = new AtomicReference<>();
        AtomicReference<String> proxied = new AtomicReference<>();
        HttpServer target = server("direct", direct);
        HttpServer proxy = server("proxied", proxied);
        RestClient http = RestClient.builder()
                .requestFactory(OutboundHttp.liveRequestFactory(NAME, setting::get, TIMEOUT, TIMEOUT))
                .build();
        try {
            assertThat(http.get().uri("http://127.0.0.1:" + target.getAddress().getPort() + "/captions")
                    .retrieve().body(String.class)).isEqualTo("direct");
            assertThat(direct.get()).isEqualTo("/captions");

            setting.set("http://127.0.0.1:" + proxy.getAddress().getPort());
            assertThat(http.get().uri("http://youtube.test/captions").retrieve().body(String.class))
                    .isEqualTo("proxied");
            assertThat(proxied.get()).isEqualTo("http://youtube.test/captions");
        } finally {
            target.stop(0);
            proxy.stop(0);
        }
    }

    @Test
    void keepsTheFactoryWhileTheProxyIsTheSame() {
        LiveProxyRequestFactory live = new LiveProxyRequestFactory(NAME, setting::get, TIMEOUT, TIMEOUT, true);
        ClientHttpRequestFactory direct = live.factory();
        assertThat(live.factory()).isSameAs(direct);

        setting.set("socks5://127.0.0.1:1080");
        ClientHttpRequestFactory socks = live.factory();
        assertThat(socks).isNotSameAs(direct);
        setting.set(" socks5://127.0.0.1:1080 ");
        assertThat(live.factory()).isSameAs(socks);

        setting.set("");
        assertThat(live.factory()).isNotSameAs(socks);
        assertThat(OutboundHttp.liveStreamingRequestFactory(NAME, setting::get, TIMEOUT, TIMEOUT))
                .isInstanceOf(LiveProxyRequestFactory.class);
    }

    @Test
    void anInvalidProxyNamesItsSetting() {
        setting.set("ftp://proxy:21");
        LiveProxyRequestFactory live = new LiveProxyRequestFactory(NAME, setting::get, TIMEOUT, TIMEOUT, false);
        assertThatThrownBy(live::factory).isInstanceOf(IllegalStateException.class).hasMessageStartingWith(NAME);
    }

    private static HttpServer server(String answer, AtomicReference<String> uri) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.createContext("/", exchange -> {
            uri.set(exchange.getRequestURI().toString());
            byte[] body = answer.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "text/plain");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        return server;
    }
}

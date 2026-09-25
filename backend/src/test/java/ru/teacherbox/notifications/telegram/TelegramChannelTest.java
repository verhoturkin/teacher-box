package ru.teacherbox.notifications.telegram;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import ru.teacherbox.notifications.application.DeliveryException;
import ru.teacherbox.notifications.application.IncomingMessage;
import ru.teacherbox.notifications.application.NotificationsProperties;
import ru.teacherbox.notifications.domain.ChannelType;

class TelegramChannelTest {

    private static final String API = "https://api.telegram.org/bot123:SECRET/";

    private final RestClient.Builder builder = RestClient.builder().baseUrl("https://api.telegram.org");
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final TelegramChannel channel = new TelegramChannel(builder.build(), "123:SECRET");

    @Test
    void sendsPlainTextWithoutLinkPreview() {
        server.expect(requestTo(API + "sendMessage"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.chat_id").value("42"))
                .andExpect(jsonPath("$.text").value("Привет"))
                .andExpect(jsonPath("$.link_preview_options.is_disabled").value(true))
                .andRespond(withSuccess("{\"ok\":true,\"result\":{}}", MediaType.APPLICATION_JSON));

        channel.send("42", "Привет");

        server.verify();
        assertThat(channel.type()).isEqualTo(ChannelType.TELEGRAM);
    }

    @Test
    void blockedBotIsPermanentFailure() {
        server.expect(requestTo(API + "sendMessage"))
                .andRespond(withStatus(HttpStatus.FORBIDDEN).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"ok\":false,\"error_code\":403,\"description\":\"Forbidden: bot was blocked by the user\"}"));

        assertThatThrownBy(() -> channel.send("42", "Привет"))
                .isInstanceOfSatisfying(DeliveryException.class, e -> {
                    assertThat(e.isPermanent()).isTrue();
                    assertThat(e.getMessage()).isEqualTo("Telegram 403: Forbidden: bot was blocked by the user");
                });
    }

    @Test
    void rateLimitServerErrorsAndNetworkProblemsAreRetried() {
        server.expect(requestTo(API + "sendMessage"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"ok\":false,\"error_code\":429,\"description\":\"Too Many Requests: retry after 5\"}"));
        server.expect(requestTo(API + "sendMessage")).andRespond(withStatus(HttpStatus.BAD_GATEWAY));
        server.expect(requestTo(API + "sendMessage")).andRespond(request -> {
            throw new IOException("Connection reset");
        });

        assertThatThrownBy(() -> channel.send("42", "1"))
                .isInstanceOfSatisfying(DeliveryException.class, e -> assertThat(e.isPermanent()).isFalse());
        assertThatThrownBy(() -> channel.send("42", "2"))
                .isInstanceOfSatisfying(DeliveryException.class, e -> assertThat(e.isPermanent()).isFalse());
        assertThatThrownBy(() -> channel.send("42", "3"))
                .isInstanceOfSatisfying(DeliveryException.class, e -> {
                    assertThat(e.isPermanent()).isFalse();
                    assertThat(e.getMessage()).contains("Connection reset").doesNotContain("SECRET");
                });
    }

    @Test
    void receivesPrivateTextMessagesAndAdvancesOffset() {
        server.expect(requestTo(API + "getUpdates"))
                .andExpect(jsonPath("$.offset").value(0))
                .andExpect(jsonPath("$.timeout").value(25))
                .andExpect(jsonPath("$.allowed_updates[0]").value("message"))
                .andRespond(withSuccess("""
                        {"ok": true, "result": [
                          {"update_id": 10, "message": {"chat": {"id": 42, "type": "private"},
                            "from": {"id": 42, "first_name": "Мария", "username": "maria"}, "text": "/start ABCD2345"}},
                          {"update_id": 11, "message": {"chat": {"id": -5, "type": "group"},
                            "from": {"id": 42}, "text": "в группе"}},
                          {"update_id": 12, "message": {"chat": {"id": 42, "type": "private"}, "from": {"id": 42}}},
                          {"update_id": 13, "message": {"chat": {"id": 43, "type": "private"},
                            "from": {"id": 43, "first_name": "Пётр", "last_name": "Петров"}, "text": "привет"}},
                          {"update_id": 14, "message": {"chat": {"id": 44, "type": "private"},
                            "from": {"id": 44}, "text": "аноним"}}
                        ]}
                        """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(API + "getUpdates"))
                .andExpect(jsonPath("$.offset").value(15))
                .andRespond(withSuccess("{\"ok\": true, \"result\": []}", MediaType.APPLICATION_JSON));

        assertThat(channel.poll()).containsExactly(
                new IncomingMessage("42", "@maria", "/start ABCD2345"),
                new IncomingMessage("43", "Пётр Петров", "привет"),
                new IncomingMessage("44", null, "аноним"));
        assertThat(channel.poll()).isEmpty();
        server.verify();
    }

    @Test
    void pollingErrorsDoNotLeakTheToken() {
        server.expect(requestTo(API + "getUpdates"))
                .andRespond(withStatus(HttpStatus.CONFLICT).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"ok\":false,\"error_code\":409,\"description\":\"Conflict: webhook is active\"}"));
        server.expect(requestTo(API + "getUpdates")).andRespond(request -> {
            throw new IOException("timeout");
        });
        server.expect(requestTo(API + "getUpdates"))
                .andRespond(withSuccess("{\"ok\": false}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(channel::poll).hasMessage("Telegram getUpdates 409: Conflict: webhook is active");
        assertThatThrownBy(channel::poll).hasMessageContaining("timeout").hasMessageNotContaining("SECRET");
        assertThatThrownBy(channel::poll).hasMessage("Telegram getUpdates failed");
    }

    @Test
    void deepLinkUsesBotUsernameLoadedOnce() {
        server.expect(requestTo(API + "getMe"))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        server.expect(requestTo(API + "getMe"))
                .andRespond(withSuccess("{\"ok\":true,\"result\":{\"username\":\"teacher_bot\"}}",
                        MediaType.APPLICATION_JSON));

        assertThat(channel.chatLink("ABCD2345")).isEmpty();
        assertThat(channel.chatLink("ABCD2345")).contains("https://t.me/teacher_bot?start=ABCD2345");
        assertThat(channel.chatLink("EFGH6789")).contains("https://t.me/teacher_bot?start=EFGH6789");
        server.verify();
    }

    @Test
    void enabledOnlyWhenConfigured() {
        ApplicationContextRunner runner = new ApplicationContextRunner()
                .withUserConfiguration(PropertiesConfiguration.class, TelegramConfiguration.class)
                .withBean(RestClient.Builder.class, RestClient::builder);

        runner.run(context -> assertThat(context).doesNotHaveBean(TelegramChannel.class));
        runner.withPropertyValues("teacherbox.notifications.telegram.bot-token= ", "teacherbox.notifications.max.token= ")
                .run(context -> assertThat(context).doesNotHaveBean(TelegramChannel.class));
        runner.withPropertyValues("teacherbox.notifications.telegram.bot-token=123:ABC")
                .run(context -> assertThat(context).hasSingleBean(TelegramChannel.class));
    }

    @Test
    void goesThroughTheConfiguredProxy() throws IOException {
        AtomicReference<String> uri = new AtomicReference<>();
        HttpServer proxy = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        proxy.createContext("/", exchange -> {
            uri.set(exchange.getRequestURI().toString());
            exchange.getRequestBody().readAllBytes();
            byte[] body = "{\"ok\": true, \"result\": {}}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        proxy.start();
        ApplicationContextRunner runner = new ApplicationContextRunner()
                .withUserConfiguration(PropertiesConfiguration.class, TelegramConfiguration.class)
                .withBean(RestClient.Builder.class, RestClient::builder)
                .withPropertyValues("teacherbox.notifications.telegram.bot-token=123:ABC",
                        "teacherbox.notifications.telegram.api-url=http://api.telegram.test");
        try {
            runner.withPropertyValues("teacherbox.notifications.telegram.proxy=http://127.0.0.1:"
                            + proxy.getAddress().getPort())
                    .run(context -> {
                        context.getBean(TelegramChannel.class).send("42", "Привет");

                        assertThat(uri.get()).isEqualTo("http://api.telegram.test/bot123:ABC/sendMessage");
                    });
        } finally {
            proxy.stop(0);
        }
        runner.withPropertyValues("teacherbox.notifications.telegram.proxy=socks5://vpn")
                .run(context -> assertThat(context).hasFailed().getFailure()
                        .hasMessageContaining("TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY"));
    }

    @EnableConfigurationProperties(NotificationsProperties.class)
    static class PropertiesConfiguration {
    }
}

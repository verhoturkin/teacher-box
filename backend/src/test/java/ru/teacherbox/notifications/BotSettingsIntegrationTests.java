package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/**
 * The teacher configures a MAX bot in the settings page; a local server imitates the MAX Bot API
 * (the token {@code good-token} is accepted).
 */
@NotificationsIntegrationTest
class BotSettingsIntegrationTests {

    private static final List<String> SENT = new CopyOnWriteArrayList<>();
    private static final HttpServer MAX = startMax();

    @DynamicPropertySource
    static void maxApi(DynamicPropertyRegistry registry) {
        registry.add("teacherbox.notifications.max.api-url", () -> "http://127.0.0.1:" + MAX.getAddress().getPort());
    }

    @AfterAll
    static void stopMax() {
        MAX.stop(0);
    }

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    ChannelLinkRepository links;

    @Autowired
    MutableClock clock;

    @Test
    void theTeacherConfiguresABotWithoutRestarting() {
        assertThat(mvc.delete().uri("/api/teacher/notifications/channels/MAX").with(teacher()))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri("/api/teacher/notifications/channels").with(teacher()))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[?(@.channel == 'MAX')].configured").asArray()
                            .containsExactly(false);
                    assertThat(json).extractingPath("$[?(@.channel == 'MAX')].connection.connection").asArray()
                            .containsExactly("PENDING");
                });

        assertThat(save("MAX", "{\"token\":\"wrong\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.code").isEqualTo("notifications.channel-check-failed");
                    assertThat(json).extractingPath("$.detail").asString().contains("Invalid access_token");
                });
        assertThat(save("MAX", "{\"token\":\" good-token \"}"))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.configured").isEqualTo(true);
                    assertThat(json).extractingPath("$.fromEnvironment").isEqualTo(false);
                    assertThat(json).extractingPath("$.botName").isEqualTo("@school_bot");
                });

        assertThat(mvc.get().uri("/api/me/channels").with(teacher()))
                .bodyJson().extractingPath("$[*].channel").asArray().contains("MAX");
        assertThat(mvc.post().uri("/api/me/channels/MAX/link-code").with(teacher()))
                .hasStatus(HttpStatus.CREATED)
                .bodyJson().extractingPath("$.url").asString().startsWith("https://max.ru/school_bot?start=");
    }

    @Test
    void theTeacherSendsATestMessage() {
        assertThat(save("MAX", "{\"token\":\"good-token\"}")).hasStatusOk();
        assertThat(mvc.post().uri("/api/teacher/notifications/channels/MAX/test").with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("notifications.channel-not-linked");
        links.save(new ChannelLink(Ids.newId(), directory.teacherId(), ChannelType.MAX, "700", "@teacher", true,
                clock.instant()));

        assertThat(mvc.post().uri("/api/teacher/notifications/channels/MAX/test").with(teacher()))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(SENT).anyMatch(message -> message.contains("Проверка связи"));
        assertThat(mvc.get().uri("/api/teacher/notifications/channels").with(teacher()))
                .bodyJson().extractingPath("$[?(@.channel == 'MAX')].teacherLinked").asArray().containsExactly(true);
    }

    @Test
    void theTeacherRemovesTheBot() {
        assertThat(save("MAX", "{\"token\":\"good-token\"}")).hasStatusOk();

        assertThat(mvc.delete().uri("/api/teacher/notifications/channels/MAX").with(teacher()))
                .hasStatus(HttpStatus.NO_CONTENT);

        assertThat(mvc.get().uri("/api/me/channels").with(teacher()))
                .bodyJson().extractingPath("$[*].channel").asArray().doesNotContain("MAX");
        assertThat(mvc.post().uri("/api/teacher/notifications/channels/MAX/test").with(teacher()))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("notifications.channel-unavailable");
    }

    @Test
    void incompleteSettingsAreRejected() {
        assertThat(save("VK", "{\"token\":\"vk-token\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("notifications.channel-check-failed");
        assertThat(save("VK", "{\"token\":\"\"}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(save("VK", "{\"token\":\"t\",\"groupId\":-1}")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void onlyTheTeacherConfiguresBots() {
        UUID student = directory.addStudent("Не учитель");

        assertThat(mvc.get().uri("/api/teacher/notifications/channels").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private MvcTestResult save(String channel, String body) {
        return mvc.put().uri("/api/teacher/notifications/channels/" + channel).with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    private static HttpServer startMax() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
            server.createContext("/me", exchange -> {
                boolean valid = "good-token".equals(exchange.getRequestHeaders().getFirst("Authorization"));
                byte[] body = (valid ? "{\"user_id\": 1, \"username\": \"school_bot\"}"
                        : "{\"message\": \"Invalid access_token\"}").getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(valid ? 200 : 401, body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            server.createContext("/messages", exchange -> {
                SENT.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                byte[] body = "{\"message\": {}}".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            server.start();
            return server;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}

package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.notifications.application.ChannelService;
import ru.teacherbox.notifications.application.IncomingMessage;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.DeliveryStatus;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.DeliveryRepository;
import ru.teacherbox.notifications.application.NotificationService;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Connecting a messenger with a one-time code and managing it. */
@NotificationsIntegrationTest
class ChannelsIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    ChannelService channels;

    @Autowired
    NotificationService notifications;

    @Autowired
    ChannelLinkRepository links;

    @Autowired
    DeliveryRepository deliveries;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @BeforeEach
    void setUp() {
        clock.advance(Duration.ofSeconds(1));
    }

    @Test
    void listsConfiguredMessengersOnly() {
        UUID student = directory.addStudent("Новичок");

        assertThat(mvc.get().uri("/api/me/channels").with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.length()").isEqualTo(1);
                    assertThat(json).extractingPath("$[0].channel").isEqualTo("TELEGRAM");
                    assertThat(json).extractingPath("$[0].linked").isEqualTo(false);
                });
    }

    @Test
    void connectsWithCodeFromDeepLink() {
        UUID student = directory.addStudent("Мария");

        String code = linkCode(student);
        String reply = channels.handleIncoming(ChannelType.TELEGRAM,
                new IncomingMessage("1001", "@maria", "/start " + code.replace("-", "")));

        assertThat(reply).contains("Готово");
        assertThat(mvc.get().uri("/api/me/channels").with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[0].linked").isEqualTo(true);
                    assertThat(json).extractingPath("$[0].enabled").isEqualTo(true);
                    assertThat(json).extractingPath("$[0].displayName").isEqualTo("@maria");
                });
        assertThat(channels.handleIncoming(ChannelType.TELEGRAM, new IncomingMessage("1001", "@maria", "спасибо")))
                .contains("получает уведомления");
    }

    @Test
    void connectsWithTypedCodeOnce() {
        UUID student = directory.addStudent("Пётр");
        String code = linkCode(student);

        assertThat(channels.handleIncoming(ChannelType.TELEGRAM,
                new IncomingMessage("1002", null, "мой код: " + code.toLowerCase()))).contains("Готово");
        assertThat(channels.handleIncoming(ChannelType.TELEGRAM, new IncomingMessage("1003", null, code)))
                .contains("не найден");
        assertThat(links.find(student, ChannelType.TELEGRAM)).get()
                .satisfies(link -> assertThat(link.externalId()).isEqualTo("1002"));
    }

    @Test
    void rejectsExpiredReplacedAndForeignCodes() {
        UUID student = directory.addStudent("Опоздавший");
        String expired = linkCode(student);
        clock.advance(Duration.ofMinutes(16));
        assertThat(channels.handleIncoming(ChannelType.TELEGRAM, new IncomingMessage("2001", null, expired)))
                .contains("не найден");

        String replaced = linkCode(student);
        String current = linkCode(student);
        assertThat(channels.handleIncoming(ChannelType.TELEGRAM, new IncomingMessage("2001", null, replaced)))
                .contains("не найден");
        assertThat(channels.handleIncoming(ChannelType.VK, new IncomingMessage("2001", null, current)))
                .contains("не найден");
        assertThat(channels.handleIncoming(ChannelType.TELEGRAM, new IncomingMessage("2001", null, current)))
                .contains("Готово");
    }

    @Test
    void explainsHowToConnect() {
        assertThat(channels.handleIncoming(ChannelType.TELEGRAM, new IncomingMessage("3001", null, "/start")))
                .contains("Чтобы получать уведомления");
        assertThat(channels.handleIncoming(ChannelType.TELEGRAM, new IncomingMessage("3001", null, "/stop")))
                .contains("не подключён");
    }

    @Test
    void stopDisconnectsEveryRecipientOfTheChat() {
        UUID first = directory.addStudent("Старший");
        UUID second = directory.addStudent("Младший");
        channels.handleIncoming(ChannelType.TELEGRAM, new IncomingMessage("4001", "@parent", linkCode(first)));
        channels.handleIncoming(ChannelType.TELEGRAM, new IncomingMessage("4001", "@parent", linkCode(second)));
        notifications.notify(first, NotificationKind.MESSAGE, "Ожидает отправки", null, null);

        assertThat(channels.handleIncoming(ChannelType.TELEGRAM, new IncomingMessage("4001", null, "/stop")))
                .contains("отключены");

        assertThat(links.find(first, ChannelType.TELEGRAM)).isEmpty();
        assertThat(links.find(second, ChannelType.TELEGRAM)).isEmpty();
        assertThat(deliveries.findByRecipient(first)).singleElement()
                .satisfies(d -> assertThat(d.status()).isEqualTo(DeliveryStatus.FAILED));
    }

    @Test
    void pausesResumesAndUnlinks() {
        UUID student = directory.addStudent("Настройщик");
        channels.handleIncoming(ChannelType.TELEGRAM, new IncomingMessage("5001", "@tuner", linkCode(student)));
        notifications.notify(student, NotificationKind.MESSAGE, "До паузы", null, null);

        assertThat(mvc.put().uri("/api/me/channels/TELEGRAM").with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\": false}"))
                .hasStatusOk()
                .bodyJson().extractingPath("$.enabled").isEqualTo(false);
        notifications.notify(student, NotificationKind.MESSAGE, "Во время паузы", null, null);
        assertThat(deliveries.findByRecipient(student)).singleElement()
                .satisfies(d -> assertThat(d.status()).isEqualTo(DeliveryStatus.FAILED));

        assertThat(mvc.put().uri("/api/me/channels/TELEGRAM").with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\": true}"))
                .hasStatusOk()
                .bodyJson().extractingPath("$.enabled").isEqualTo(true);
        notifications.notify(student, NotificationKind.MESSAGE, "После паузы", null, null);
        assertThat(deliveries.findByRecipient(student)).hasSize(2).last()
                .satisfies(d -> assertThat(d.status()).isEqualTo(DeliveryStatus.PENDING));

        assertThat(mvc.delete().uri("/api/me/channels/TELEGRAM").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(links.find(student, ChannelType.TELEGRAM)).isEmpty();
        assertThat(deliveries.findByRecipient(student))
                .allSatisfy(d -> assertThat(d.status()).isEqualTo(DeliveryStatus.FAILED));
        assertThat(mvc.put().uri("/api/me/channels/TELEGRAM").with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\": true}"))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("notifications.channel-not-linked");
    }

    @Test
    void messengerNotConfiguredOnThisInstance() {
        UUID student = directory.addStudent("ВКонтакте");

        assertThat(mvc.post().uri("/api/me/channels/VK/link-code").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("notifications.channel-unavailable");
    }

    @Test
    void teacherConnectsMessengerToo() {
        UUID teacher = directory.teacherId();

        MvcTestResult result = mvc.post().uri("/api/me/channels/TELEGRAM/link-code").with(TestUsers.teacher(teacher))
                .exchange();

        assertThat(result).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.channel").isEqualTo("TELEGRAM");
            assertThat(json).extractingPath("$.code").asString().matches("[A-Z2-9]{4}-[A-Z2-9]{4}");
            assertThat(json).extractingPath("$.url").asString().startsWith("https://t.me/test_bot?start=");
        });
    }

    /** Requests a code through the API and returns its display form ("ABCD-2345"). */
    private String linkCode(UUID student) {
        MvcTestResult result = mvc.post().uri("/api/me/channels/TELEGRAM/link-code").with(TestUsers.student(student))
                .exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
        try {
            return JsonPath.read(result.getResponse().getContentAsString(), "$.code");
        } catch (java.io.UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}

package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.notifications.application.DeliveryDispatcher;
import ru.teacherbox.notifications.application.NotificationService;
import ru.teacherbox.notifications.application.NotificationsHousekeeping;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.Delivery;
import ru.teacherbox.notifications.domain.DeliveryStatus;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.persistence.DeliveryRepository;
import ru.teacherbox.notifications.persistence.PushSubscriptionRepository;
import ru.teacherbox.notifications.webpush.PushTarget;
import ru.teacherbox.notifications.webpush.WebPushSender;
import ru.teacherbox.notifications.webpush.WebPushSender.Outcome;
import ru.teacherbox.notifications.webpush.WebPushSender.Result;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Devices that get web push: their REST, the delivery to them and what happens to dead ones (ADR-0051). */
@NotificationsIntegrationTest
class PushIntegrationTests {

    private static final String ENDPOINT = "https://push.example.com/send/";

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    PushSubscriptionRepository subscriptions;

    @Autowired
    DeliveryRepository deliveries;

    @Autowired
    NotificationService notifications;

    @Autowired
    DeliveryDispatcher dispatcher;

    @Autowired
    NotificationsHousekeeping housekeeping;

    @Autowired
    MutableClock clock;

    @MockitoBean
    WebPushSender sender;

    @BeforeEach
    void resetSender() {
        reset(sender);
    }

    @Test
    void anyoneButTheAdministratorGetsThePublicKey() {
        assertThat(mvc.get().uri("/api/me/push/key").with(TestUsers.student(UUID.randomUUID())))
                .hasStatusOk()
                .bodyJson().extractingPath("$.key").asString().hasSize(87);
        assertThat(mvc.get().uri("/api/me/push/key").with(TestUsers.teacher(UUID.randomUUID()))).hasStatusOk();
        assertThat(mvc.get().uri("/api/me/push/key").with(TestUsers.admin(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/push/key")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void administratorHasNoDevicesAndCannotSubscribe() {
        UUID admin = UUID.randomUUID();

        assertThat(mvc.get().uri("/api/me/push/subscriptions").with(TestUsers.admin(admin)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(subscribe(TestUsers.admin(admin), endpoint("admin"))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.delete().uri("/api/me/push/subscriptions/" + UUID.randomUUID()).with(TestUsers.admin(admin)))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void userSubscribesListsAndRemovesOnlyOwnDevices() {
        UUID student = directory.addStudent("Первый");
        UUID other = directory.addStudent("Второй");
        UUID teacher = UUID.randomUUID();

        MvcTestResult created = subscribe(TestUsers.student(student), endpoint("own"));
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.id").isNotNull();
            assertThat(json).extractingPath("$.failing").isEqualTo(false);
            assertThat(json).asString().doesNotContain("endpoint").doesNotContain("push.example.com");
        });
        UUID id = subscriptions.findByUser(student).getFirst().id();
        subscribe(TestUsers.teacher(teacher), endpoint("teacher"));

        assertThat(mvc.get().uri("/api/me/push/subscriptions").with(TestUsers.student(student)))
                .hasStatusOk().bodyJson().extractingPath("$").asArray().hasSize(1);
        assertThat(mvc.get().uri("/api/me/push/subscriptions").with(TestUsers.student(other)))
                .hasStatusOk().bodyJson().extractingPath("$").asArray().isEmpty();
        assertThat(mvc.get().uri("/api/me/push/subscriptions").with(TestUsers.teacher(teacher)))
                .hasStatusOk().bodyJson().extractingPath("$").asArray().hasSize(1);

        assertThat(mvc.delete().uri("/api/me/push/subscriptions/" + id).with(TestUsers.student(other)))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.delete().uri("/api/me/push/subscriptions/" + UUID.randomUUID())
                .with(TestUsers.student(student))).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(subscriptions.findByUser(student)).hasSize(1);

        assertThat(mvc.delete().uri("/api/me/push/subscriptions/" + id).with(TestUsers.student(student)))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(subscriptions.findByUser(student)).isEmpty();
    }

    @Test
    void subscribingTheSameBrowserAgainKeepsOneDevice() {
        UUID student = directory.addStudent("Дважды");

        subscribe(TestUsers.student(student), endpoint("again"));
        subscribe(TestUsers.student(student), endpoint("again"));

        assertThat(subscriptions.findByUser(student)).hasSize(1);
    }

    @Test
    void rejectsBrokenSubscriptions() {
        UUID student = directory.addStudent("Ошибка");
        String keys = "\"keys\":{\"p256dh\":\"%s\",\"auth\":\"%s\"}".formatted(base64(65), base64(16));

        assertThat(post(student, "{\"endpoint\":\"http://push.example.com/x\"," + keys + "}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("push.subscription-invalid");
        assertThat(post(student, "{\"endpoint\":\"" + ENDPOINT + "x\",\"keys\":{\"p256dh\":\"" + base64(10)
                + "\",\"auth\":\"" + base64(16) + "\"}}")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(post(student, "{\"endpoint\":\"" + ENDPOINT + "x\",\"keys\":{\"p256dh\":\"***\",\"auth\":\""
                + base64(16) + "\"}}")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(post(student, "{\"endpoint\":\"" + ENDPOINT + "x\"}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(post(student, "{\"keys\":{}}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(subscriptions.findByUser(student)).isEmpty();
    }

    @Test
    void administratorSeesOnlyCounts() {
        UUID student = directory.addStudent("Счётчик");
        subscribe(TestUsers.student(student), endpoint("counted"));

        assertThat(mvc.get().uri("/api/admin/notifications/push").with(TestUsers.admin(UUID.randomUUID())))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.subscriptions").asNumber().isNotEqualTo(0);
                    assertThat(json).extractingPath("$.failing").isNotNull();
                    assertThat(json).asString().doesNotContain("counted").doesNotContain(student.toString());
                });
        assertThat(mvc.get().uri("/api/admin/notifications/push").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void notificationIsPushedToEveryDeviceInTheNgswFormat() {
        UUID student = directory.addStudent("Два устройства");
        subscribe(TestUsers.student(student), endpoint("phone"));
        subscribe(TestUsers.student(student), endpoint("laptop"));
        when(sender.send(any(), any(), any(), any())).thenReturn(new Result(Outcome.SENT, 201));

        var notification = notifications.notify(student, NotificationKind.MESSAGE, "Новое сообщение", "Текст",
                "/cabinet/notifications");
        assertThat(deliveries.findByRecipient(student)).hasSize(2)
                .allSatisfy(delivery -> assertThat(delivery.channel()).isEqualTo(ChannelType.WEB_PUSH));
        dispatcher.dispatch();

        ArgumentCaptor<PushTarget> target = ArgumentCaptor.forClass(PushTarget.class);
        ArgumentCaptor<byte[]> payload = ArgumentCaptor.forClass(byte[].class);
        verify(sender, org.mockito.Mockito.times(2)).send(target.capture(), payload.capture(),
                org.mockito.ArgumentMatchers.eq(Duration.ofDays(1)), isNull());
        assertThat(target.getAllValues()).extracting(PushTarget::endpoint)
                .containsExactlyInAnyOrder(endpoint("phone"), endpoint("laptop"));
        String message = new String(payload.getValue(), StandardCharsets.UTF_8);
        assertThat(message).contains("\"title\":\"Новое сообщение\"", "\"body\":\"Текст\"",
                "\"tag\":\"" + notification.id() + "\"",
                "\"icon\":\"https://school.example.com/push-icon.png\"",
                "\"badge\":\"https://school.example.com/push-badge.png\"",
                "\"url\":\"https://school.example.com/cabinet/notifications\"");
        assertThat(deliveries.findByRecipient(student)).extracting(Delivery::status)
                .containsOnly(DeliveryStatus.SENT);
        assertThat(subscriptions.findByUser(student)).allSatisfy(device -> {
            assertThat(device.lastSuccessAt()).isNotNull();
            assertThat(device.failures()).isZero();
        });
    }

    @Test
    void mutedTopicsAndNoDevicesMeanNoPush() {
        UUID student = directory.addStudent("Без push");

        notifications.notify(student, NotificationKind.MESSAGE, "Никому", null, null);
        assertThat(deliveries.findByRecipient(student)).isEmpty();

        subscribe(TestUsers.student(student), endpoint("muted"));
        mvc.put().uri("/api/me/notifications/preferences").with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content("{\"mutedTopics\":[\"BILLING\"]}").exchange();
        notifications.notify(student, NotificationKind.PAYMENT_RECORDED, "Оплата", null, null);

        assertThat(deliveries.findByRecipient(student)).isEmpty();
    }

    @Test
    void goneDeviceIsForgottenWithoutAFailure() {
        UUID student = directory.addStudent("Ушёл");
        subscribe(TestUsers.student(student), endpoint("gone"));
        when(sender.send(any(), any(), any(), any())).thenReturn(new Result(Outcome.GONE, 410));

        notifications.notify(student, NotificationKind.MESSAGE, "Некому", null, null);
        dispatcher.dispatch();

        assertThat(subscriptions.findByUser(student)).isEmpty();
        assertThat(deliveries.findByRecipient(student)).extracting(Delivery::status)
                .containsExactly(DeliveryStatus.SENT);
    }

    @Test
    void unsubscribedDeviceGetsNothing() {
        UUID student = directory.addStudent("Отключился");
        subscribe(TestUsers.student(student), endpoint("off"));
        notifications.notify(student, NotificationKind.MESSAGE, "Поздно", null, null);
        subscriptions.delete(subscriptions.findByUser(student).getFirst().id());

        dispatcher.dispatch();

        assertThat(deliveries.findByRecipient(student)).extracting(Delivery::status)
                .containsExactly(DeliveryStatus.SENT);
        org.mockito.Mockito.verifyNoInteractions(sender);
    }

    @Test
    void overloadedPushServiceIsRetriedWithBackoff() {
        UUID student = directory.addStudent("Перегрузка");
        subscribe(TestUsers.student(student), endpoint("busy"));
        when(sender.send(any(), any(), any(), any())).thenReturn(new Result(Outcome.RETRY, 429));

        notifications.notify(student, NotificationKind.MESSAGE, "Позже", null, null);
        dispatcher.dispatch();

        Delivery delivery = deliveries.findByRecipient(student).getFirst();
        assertThat(delivery.status()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(delivery.attempts()).isOne();
        assertThat(delivery.nextAttemptAt()).isAfter(clock.instant());
        assertThat(delivery.lastError()).contains("429");
        assertThat(subscriptions.findByUser(student).getFirst().failures()).isOne();

        when(sender.send(any(), any(), any(), any())).thenReturn(new Result(Outcome.SENT, 201));
        clock.advance(Duration.ofMinutes(5));
        dispatcher.dispatch();

        assertThat(deliveries.findByRecipient(student).getFirst().status()).isEqualTo(DeliveryStatus.SENT);
        assertThat(subscriptions.findByUser(student).getFirst().failures()).isZero();
    }

    @Test
    void refusedMessageFailsForGood() {
        UUID student = directory.addStudent("Отказ");
        subscribe(TestUsers.student(student), endpoint("refused"));
        when(sender.send(any(), any(), any(), any())).thenReturn(new Result(Outcome.REJECTED, 400));

        notifications.notify(student, NotificationKind.MESSAGE, "Нельзя", null, null);
        dispatcher.dispatch();

        Delivery delivery = deliveries.findByRecipient(student).getFirst();
        assertThat(delivery.status()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(delivery.lastError()).contains("400").doesNotContain("push.example.com");
    }

    @Test
    void housekeepingForgetsOnlyDevicesThatKeepFailing() {
        UUID student = directory.addStudent("Уборка");
        subscribe(TestUsers.student(student), endpoint("quiet"));
        subscribe(TestUsers.student(student), endpoint("dead"));
        UUID dead = subscriptions.findByEndpoint(endpoint("dead")).orElseThrow().id();
        subscriptions.markFailure(dead);

        housekeeping.purge(clock.instant());
        assertThat(subscriptions.findByUser(student)).hasSize(2);

        housekeeping.purge(clock.instant().plus(Duration.ofDays(30)).plusSeconds(1));

        assertThat(subscriptions.findByUser(student)).extracting(device -> device.endpoint())
                .containsExactly(endpoint("quiet"));
    }

    @Test
    void failingDevicesAreCountedForTheAdministrator() {
        UUID student = directory.addStudent("Счёт ошибок");
        subscribe(TestUsers.student(student), endpoint("counted-failing"));
        long before = subscriptions.counts().failing();

        subscriptions.markFailure(subscriptions.findByUser(student).getFirst().id());

        assertThat(subscriptions.counts().failing()).isEqualTo(before + 1);
    }

    private static String endpoint(String name) {
        return ENDPOINT + name;
    }

    private static String base64(int bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[bytes]);
    }

    private MvcTestResult subscribe(org.springframework.test.web.servlet.request.RequestPostProcessor user,
            String endpoint) {
        return mvc.post().uri("/api/me/push/subscriptions").with(user).contentType(MediaType.APPLICATION_JSON)
                .content("{\"endpoint\":\"%s\",\"keys\":{\"p256dh\":\"%s\",\"auth\":\"%s\"}}".formatted(endpoint,
                        base64(65), base64(16)))
                .exchange();
    }

    private MvcTestResult post(UUID student, String body) {
        return mvc.post().uri("/api/me/push/subscriptions").with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }
}

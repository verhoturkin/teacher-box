package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.notifications.application.DeliveryDispatcher;
import ru.teacherbox.notifications.application.DeliveryException;
import ru.teacherbox.notifications.application.NotificationService;
import ru.teacherbox.notifications.application.NotificationsHousekeeping;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.Delivery;
import ru.teacherbox.notifications.domain.DeliveryStatus;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.DeliveryRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The outbox: messages to messengers with retries. */
@NotificationsIntegrationTest
class DeliveryIntegrationTests {

    @Autowired
    NotificationService notifications;

    @Autowired
    DeliveryDispatcher dispatcher;

    @Autowired
    DeliveryRepository deliveries;

    @Autowired
    ChannelLinkRepository links;

    @Autowired
    FakeMessengerChannel telegram;

    @Autowired
    NotificationsHousekeeping housekeeping;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @BeforeEach
    void setUp() {
        dispatcher.dispatch();
        telegram.reset();
    }

    @Test
    void sendsToConnectedMessengerWithLinkToThePortal() {
        UUID student = connectedStudent("7001");

        notifications.notify(student, NotificationKind.HOMEWORK_ASSIGNED, "Новое задание: «Дроби»",
                "Срок сдачи: 25.09.2026 18:30", "/cabinet/homework/1");
        assertThat(dispatcher.dispatch()).isPositive();

        assertThat(telegram.sent()).containsExactly(new FakeMessengerChannel.Sent("7001",
                "Новое задание: «Дроби»\nСрок сдачи: 25.09.2026 18:30\nhttps://school.example.com/cabinet/homework/1"));
        assertThat(deliveries.findByRecipient(student)).singleElement().satisfies(delivery -> {
            assertThat(delivery.status()).isEqualTo(DeliveryStatus.SENT);
            assertThat(delivery.attempts()).isEqualTo(1);
            assertThat(delivery.sentAt()).isEqualTo(clock.instant());
        });
    }

    @Test
    void retriesTemporaryFailuresWithBackoffAndGivesUp() {
        UUID student = connectedStudent("7002");
        notifications.notify(student, NotificationKind.MESSAGE, "Повтор", null, null);
        telegram.failWith(new DeliveryException("Telegram 429: Too Many Requests", false));

        assertThat(dispatcher.dispatch()).isZero();
        Delivery first = delivery(student);
        assertThat(first.status()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(first.attempts()).isEqualTo(1);
        assertThat(first.lastError()).isEqualTo("Telegram 429: Too Many Requests");
        assertThat(first.nextAttemptAt()).isEqualTo(clock.instant().plusSeconds(30));

        assertThat(dispatcher.dispatch()).as("not due yet").isZero();
        assertThat(delivery(student).attempts()).isEqualTo(1);

        clock.advance(Duration.ofSeconds(30));
        dispatcher.dispatch();
        assertThat(delivery(student).nextAttemptAt()).isEqualTo(clock.instant().plusSeconds(60));

        clock.advance(Duration.ofSeconds(60));
        dispatcher.dispatch();
        Delivery last = delivery(student);
        assertThat(last.status()).as("max-attempts=3").isEqualTo(DeliveryStatus.FAILED);
        assertThat(last.attempts()).isEqualTo(3);
    }

    @Test
    void recoversAfterTemporaryFailure() {
        UUID student = connectedStudent("7003");
        notifications.notify(student, NotificationKind.MESSAGE, "Со второго раза", null, null);
        telegram.failWith(new DeliveryException("Telegram: timeout", false));
        dispatcher.dispatch();

        telegram.reset();
        clock.advance(Duration.ofSeconds(30));
        dispatcher.dispatch();

        assertThat(delivery(student).status()).isEqualTo(DeliveryStatus.SENT);
        assertThat(delivery(student).lastError()).isNull();
        assertThat(telegram.sent()).extracting(FakeMessengerChannel.Sent::text).containsExactly("Со второго раза");
    }

    @Test
    void permanentFailureIsNotRetried() {
        UUID student = connectedStudent("7004");
        notifications.notify(student, NotificationKind.MESSAGE, "Бот заблокирован", null, null);
        telegram.failWith(new DeliveryException("Telegram 403: Forbidden: bot was blocked by the user", true));

        dispatcher.dispatch();

        assertThat(delivery(student).status()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(delivery(student).lastError()).contains("blocked");
    }

    @Test
    void unexpectedErrorsAreRetried() {
        UUID student = connectedStudent("7005");
        notifications.notify(student, NotificationKind.MESSAGE, "Сбой", null, null);
        telegram.failWith(new IllegalStateException("boom"));

        dispatcher.dispatch();

        assertThat(delivery(student).status()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(delivery(student).lastError()).isEqualTo("IllegalStateException");
    }

    @Test
    void abandonsDeliveriesToMessengersThatAreNoLongerConfigured() {
        UUID student = directory.addStudent("Бывший пользователь VK");
        Delivery orphan = Delivery.schedule(Ids.newId(),
                notifications.notify(student, NotificationKind.MESSAGE, "VK", null, null).id(), student,
                ChannelType.VK, "42", "VK", clock.instant());
        deliveries.insert(orphan);

        dispatcher.dispatch();

        assertThat(delivery(student).status()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(delivery(student).lastError()).isEqualTo("Messenger is not configured");
    }

    @Test
    void deactivatedStudentsGetNothingInMessengers() {
        UUID student = connectedStudent("7006");
        directory.setStatus(student, StudentStatus.DEACTIVATED);

        notifications.notify(student, NotificationKind.PAYMENT_RECORDED, "Получена оплата", null, "/cabinet/billing");

        assertThat(deliveries.findByRecipient(student)).isEmpty();
    }

    @Test
    void teacherGetsMessagesTruncatedToMessengerLimit() {
        UUID teacher = directory.teacherId();
        links.save(new ChannelLink(Ids.newId(), teacher, ChannelType.TELEGRAM, "7007", "@teacher", true,
                clock.instant()));

        notifications.notify(teacher, NotificationKind.HOMEWORK_SUBMITTED, "Работа на проверку", "x".repeat(3990),
                null);
        dispatcher.dispatch();

        assertThat(telegram.sent()).singleElement().satisfies(sent -> {
            assertThat(sent.externalId()).isEqualTo("7007");
            assertThat(sent.text()).hasSize(4000).endsWith("…");
        });
    }

    @Test
    void housekeepingRemovesOldFinishedDeliveriesOnly() {
        UUID student = connectedStudent("7008");
        notifications.notify(student, NotificationKind.MESSAGE, "Отправлено давно", null, null);
        dispatcher.dispatch();
        clock.advance(Duration.ofMinutes(1));
        notifications.notify(student, NotificationKind.MESSAGE, "Ещё ждёт", null, null);

        assertThat(housekeeping.purge(clock.instant())).as("too recent").isZero();
        housekeeping.purge(clock.instant().plus(Duration.ofDays(91)));

        assertThat(deliveries.findByRecipient(student)).singleElement()
                .satisfies(delivery -> assertThat(delivery.status()).isEqualTo(DeliveryStatus.PENDING));
    }

    @Test
    void teacherSeesFailedDeliveries(@Autowired MockMvcTester mvc) {
        UUID student = connectedStudent("7009");
        notifications.notify(student, NotificationKind.MESSAGE, "Не дошло", null, null);
        telegram.failWith(new DeliveryException("Telegram 403: Forbidden: bot was blocked by the user", true));
        dispatcher.dispatch();
        UUID teacher = directory.teacherId();
        links.save(new ChannelLink(Ids.newId(), teacher, ChannelType.TELEGRAM, "7010", null, true, clock.instant()));
        clock.advance(Duration.ofSeconds(1));
        notifications.notify(teacher, NotificationKind.MESSAGE, "Учителю", null, null);
        dispatcher.dispatch();

        assertThat(mvc.get().uri("/api/teacher/notifications/status").with(TestUsers.teacher(teacher)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.channels[0].channel").isEqualTo("TELEGRAM");
                    assertThat(json).extractingPath("$.channels[0].connection").as("polling is off in tests")
                            .isEqualTo("PENDING");
                    assertThat(json).extractingPath("$.failedDeliveries[0].recipientName").isNull();
                    assertThat(json).extractingPath("$.failedDeliveries[1].recipientName").isEqualTo("Ученик 7009");
                    assertThat(json).extractingPath("$.failedDeliveries[1].channel").isEqualTo("TELEGRAM");
                    assertThat(json).extractingPath("$.failedDeliveries[1].error").asString().contains("blocked");
                    assertThat(json).extractingPath("$.failedDeliveries[1].text").isEqualTo("Не дошло");
                });
        assertThat(mvc.get().uri("/api/teacher/notifications/status").with(TestUsers.student(student)))
                .hasStatus(org.springframework.http.HttpStatus.FORBIDDEN);
    }

    private UUID connectedStudent(String chatId) {
        UUID student = directory.addStudent("Ученик " + chatId);
        links.save(new ChannelLink(Ids.newId(), student, ChannelType.TELEGRAM, chatId, null, true, clock.instant()));
        return student;
    }

    private Delivery delivery(UUID student) {
        return deliveries.findByRecipient(student).getFirst();
    }
}

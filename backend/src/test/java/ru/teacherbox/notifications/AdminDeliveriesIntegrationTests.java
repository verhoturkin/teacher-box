package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import ru.teacherbox.notifications.application.DeliveryDispatcher;
import ru.teacherbox.notifications.application.DeliveryException;
import ru.teacherbox.notifications.application.NotificationService;
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

/** The administrator sees failed deliveries without their texts and sends them again (ADR-0010). */
@NotificationsIntegrationTest
class AdminDeliveriesIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    ChannelLinkRepository links;

    @Autowired
    DeliveryRepository deliveries;

    @Autowired
    NotificationService notifications;

    @Autowired
    DeliveryDispatcher dispatcher;

    @Autowired
    FakeMessengerChannel telegram;

    @Autowired
    MutableClock clock;

    @Test
    void failedDeliveriesAreShownWithoutTextsAndRetried() {
        UUID student = directory.addStudent("Секретное имя");
        links.save(new ChannelLink(Ids.newId(), student, ChannelType.TELEGRAM, "9001", null, true, clock.instant()));
        notifications.notify(student, NotificationKind.MESSAGE, "Секретный текст", null, null);
        telegram.failWith(new DeliveryException("Forbidden: bot was blocked by the user", true));
        dispatcher.dispatch();
        telegram.reset();
        Delivery failed = deliveries.findByRecipient(student).getFirst();
        assertThat(failed.status()).isEqualTo(DeliveryStatus.FAILED);

        assertThat(mvc.get().uri("/api/admin/notifications/deliveries").with(TestUsers.admin(UUID.randomUUID())))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[?(@.id == '" + failed.id() + "')].error").asArray()
                            .containsExactly("Forbidden: bot was blocked by the user");
                    assertThat(json).extractingPath("$[?(@.id == '" + failed.id() + "')].recipientId").asArray()
                            .containsExactly(student.toString());
                    assertThat(json).asString().doesNotContain("Секретн");
                });

        assertThat(mvc.post().uri("/api/admin/notifications/deliveries/retry").with(TestUsers.admin(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"%s\"]}".formatted(failed.id())))
                .hasStatusOk()
                .bodyJson().extractingPath("$.retried").isEqualTo(1);
        Delivery retried = deliveries.findByRecipient(student).getFirst();
        assertThat(retried.status()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(retried.attempts()).isZero();

        dispatcher.dispatch();
        assertThat(deliveries.findByRecipient(student).getFirst().status()).isEqualTo(DeliveryStatus.SENT);
    }

    @Test
    void onlyTheAdministratorManagesDeliveries() {
        assertThat(mvc.get().uri("/api/admin/notifications/deliveries").with(TestUsers.teacher(directory.teacherId())))
                .hasStatus(HttpStatus.FORBIDDEN);
    }
}

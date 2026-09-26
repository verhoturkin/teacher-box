package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.notifications.application.NotificationService;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.Delivery;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.DeliveryRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** What a user gets in messengers: muted topics and quiet hours (instance time zone: Moscow). */
@NotificationsIntegrationTest
class PreferencesIntegrationTests {

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
    MutableClock clock;

    @Test
    void everythingIsSentByDefault() {
        UUID student = directory.addStudent("По умолчанию");

        assertThat(mvc.get().uri("/api/me/notifications/preferences").with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.mutedTopics").asArray().isEmpty();
                    assertThat(json).extractingPath("$.quietFrom").isNull();
                });
    }

    @Test
    void mutedTopicsStayInThePersonalArea() {
        UUID student = connectedStudent("Без оплат");
        assertThat(save(student, "{\"mutedTopics\":[\"BILLING\",\"MESSAGES\"]}"))
                .hasStatusOk()
                .bodyJson().extractingPath("$.mutedTopics").asArray().containsExactly("BILLING");

        notifications.notify(student, NotificationKind.PAYMENT_RECORDED, "Получена оплата", null, null);
        notifications.notify(student, NotificationKind.MESSAGE, "Сообщение учителя", null, null);

        assertThat(deliveries.findByRecipient(student)).extracting(Delivery::text)
                .singleElement().asString().contains("Сообщение учителя");
    }

    @Test
    void quietHoursDelayMessengers() {
        UUID student = connectedStudent("Ночью спит");
        LocalTime now = ZonedDateTime.ofInstant(clock.instant(), ZoneId.of("Europe/Moscow")).toLocalTime();
        LocalTime from = now.minusHours(1).withSecond(0).withNano(0);
        LocalTime to = now.plusHours(2).withSecond(0).withNano(0);
        assertThat(save(student, "{\"mutedTopics\":[],\"quietFrom\":\"%s\",\"quietTo\":\"%s\"}".formatted(from, to)))
                .hasStatusOk()
                .bodyJson().extractingPath("$.quietTo").asString().startsWith(to.toString());

        notifications.notify(student, NotificationKind.HOMEWORK_ASSIGNED, "Новое задание", null, null);

        Instant attempt = deliveries.findByRecipient(student).getFirst().nextAttemptAt();
        assertThat(attempt).isAfter(clock.instant().plus(Duration.ofMinutes(30)));
    }

    @Test
    void validatesQuietHours() {
        UUID student = directory.addStudent("Ошибка");

        assertThat(save(student, "{\"mutedTopics\":[],\"quietFrom\":\"22:00\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("notification.quiet-hours-invalid");
        assertThat(save(student, "{\"quietFrom\":null}")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    private MvcTestResult save(UUID user, String body) {
        return mvc.put().uri("/api/me/notifications/preferences").with(TestUsers.student(user))
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private UUID connectedStudent(String name) {
        UUID student = directory.addStudent(name);
        links.save(new ChannelLink(Ids.newId(), student, ChannelType.TELEGRAM, "chat-" + student, null, true,
                clock.instant()));
        return student;
    }
}

package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.notifications.application.DeliveryDispatcher;
import ru.teacherbox.notifications.application.DeliveryException;
import ru.teacherbox.notifications.application.NotificationService;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.InboxRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The teacher sees who connected a messenger, reminds the others and reads the history of messages. */
@NotificationsIntegrationTest
class StudentMessengersIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    ChannelLinkRepository links;

    @Autowired
    InboxRepository inbox;

    @Autowired
    NotificationService notifications;

    @Autowired
    DeliveryDispatcher dispatcher;

    @Autowired
    FakeMessengerChannel telegram;

    @Autowired
    MutableClock clock;

    @Test
    void listsStudentsWithTheirMessengersAndProblems() {
        UUID connected = directory.addStudent("Аня с Telegram");
        links.save(new ChannelLink(Ids.newId(), connected, ChannelType.TELEGRAM, "8001", "@anya", true,
                clock.instant()));
        UUID silent = directory.addStudent("Боря без мессенджеров");
        UUID gone = directory.addStudent("Ушедший", StudentStatus.DEACTIVATED);
        telegram.failWith(new DeliveryException("Forbidden: bot was blocked by the user", true));
        notifications.notify(connected, NotificationKind.MESSAGE, "Не дойдёт", null, null);
        dispatcher.dispatch();
        telegram.reset();

        assertThat(mvc.get().uri("/api/teacher/notifications/students").with(teacher()))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[?(@.studentId == '" + connected + "')].channels[0].channel")
                            .asArray().containsExactly("TELEGRAM");
                    assertThat(json).extractingPath("$[?(@.studentId == '" + connected + "')].failedDeliveries")
                            .asArray().containsExactly(1);
                    assertThat(json).extractingPath("$[?(@.studentId == '" + silent + "')].channels").asArray()
                            .singleElement().asList().isEmpty();
                    assertThat(json).extractingPath("$[?(@.studentId == '" + gone + "')]").asArray().isEmpty();
                });
    }

    @Test
    void summarizesMessengersForTheHomePage() throws UnsupportedEncodingException {
        String before = summary();
        UUID connected = directory.addStudent("Сводка с ботом");
        links.save(new ChannelLink(Ids.newId(), connected, ChannelType.TELEGRAM, "8003", null, true, clock.instant()));
        directory.addStudent("Сводка без бота");
        telegram.failWith(new DeliveryException("Forbidden: bot was blocked by the user", true));
        notifications.notify(connected, NotificationKind.MESSAGE, "Не дойдёт", null, null);
        dispatcher.dispatch();
        telegram.reset();

        String after = summary();

        assertThat(number(after, "$.failedDeliveries")).isEqualTo(number(before, "$.failedDeliveries") + 1);
        assertThat(number(after, "$.students")).isEqualTo(number(before, "$.students") + 2);
        assertThat(number(after, "$.studentsWithMessenger")).isEqualTo(number(before, "$.studentsWithMessenger") + 1);
        assertThat(JsonPath.<Boolean>read(after, "$.messengerConfigured")).isTrue();
        assertThat(mvc.get().uri("/api/teacher/notifications/summary").with(TestUsers.student(connected)))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void remindsStudentsWithoutMessengers() {
        UUID connected = directory.addStudent("Уже подключён");
        links.save(new ChannelLink(Ids.newId(), connected, ChannelType.TELEGRAM, "8002", null, true, clock.instant()));
        UUID silent = directory.addStudent("Забыл подключить");

        assertThat(mvc.post().uri("/api/teacher/notifications/remind-connect").with(teacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentIds\":[\"%s\",\"%s\"]}".formatted(connected, silent)))
                .hasStatusOk()
                .bodyJson().extractingPath("$.recipients").isEqualTo(1);

        assertThat(inbox.findPage(silent, 0, 10)).singleElement().satisfies(notification -> {
            assertThat(notification.title()).isEqualTo("Подключите мессенджер");
            assertThat(notification.link()).isEqualTo("/cabinet/notifications");
        });
        assertThat(inbox.findPage(connected, 0, 10)).isEmpty();
        assertThat(mvc.post().uri("/api/teacher/notifications/remind-connect").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .hasStatusOk();
    }

    @Test
    void keepsTheHistoryOfMessages() {
        directory.addStudent("Читатель");

        assertThat(mvc.post().uri("/api/teacher/notifications/broadcast").with(teacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Каникулы\",\"body\":\"  Занятий не будет  \"}"))
                .hasStatusOk();

        assertThat(mvc.get().uri("/api/teacher/notifications/broadcasts").with(teacher()))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[?(@.title == 'Каникулы')].body").asArray()
                            .containsExactly("Занятий не будет");
                    assertThat(json).extractingPath("$[?(@.title == 'Каникулы')].recipients").asArray()
                            .singleElement().isNotEqualTo(0);
                });
        assertThat(mvc.get().uri("/api/teacher/notifications/broadcasts")
                .with(TestUsers.student(UUID.randomUUID()))).hasStatus(HttpStatus.FORBIDDEN);
    }

    private String summary() throws UnsupportedEncodingException {
        MvcTestResult result = mvc.get().uri("/api/teacher/notifications/summary").with(teacher()).exchange();
        assertThat(result).hasStatusOk();
        return result.getResponse().getContentAsString();
    }

    private static long number(String json, String path) {
        return JsonPath.<Number>read(json, path).longValue();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}

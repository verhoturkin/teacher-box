package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.notifications.application.NotificationService;
import ru.teacherbox.notifications.domain.InboxNotification;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.persistence.InboxRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The personal area inbox and the teacher's messages to students. */
@NotificationsIntegrationTest
class InboxIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    NotificationService notifications;

    @Autowired
    InboxRepository inbox;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @Test
    void listsNewestFirstAndCountsUnread() {
        UUID student = directory.addStudent("Читатель");
        notify(student, "Первое");
        clock.advance(Duration.ofMinutes(1));
        notify(student, "Второе");
        clock.advance(Duration.ofMinutes(1));
        notify(student, "Третье");

        assertThat(mvc.get().uri("/api/me/notifications?size=2").with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.total").isEqualTo(3);
                    assertThat(json).extractingPath("$.unread").isEqualTo(3);
                    assertThat(json).extractingPath("$.items[0].title").isEqualTo("Третье");
                    assertThat(json).extractingPath("$.items[0].read").isEqualTo(false);
                    assertThat(json).extractingPath("$.items[0].kind").isEqualTo("MESSAGE");
                    assertThat(json).extractingPath("$.items[1].title").isEqualTo("Второе");
                });
        assertThat(mvc.get().uri("/api/me/notifications?page=1&size=2").with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().extractingPath("$.items[0].title").isEqualTo("Первое");
        assertThat(mvc.get().uri("/api/me/notifications/unread-count").with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().extractingPath("$.count").isEqualTo(3);
    }

    @Test
    void marksOneOrAllAsRead() {
        UUID student = directory.addStudent("Внимательный");
        InboxNotification first = notify(student, "Первое");
        notify(student, "Второе");

        assertThat(mvc.post().uri("/api/me/notifications/" + first.id() + "/read").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.post().uri("/api/me/notifications/" + first.id() + "/read").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(inbox.findById(first.id())).get().satisfies(n -> assertThat(n.isRead()).isTrue());
        assertThat(notifications.unreadCount(student)).isEqualTo(1);

        assertThat(mvc.post().uri("/api/me/notifications/read-all").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(notifications.unreadCount(student)).isZero();
    }

    @Test
    void notificationsOfOthersAreInvisible() {
        UUID owner = directory.addStudent("Владелец");
        UUID stranger = directory.addStudent("Чужой");
        InboxNotification notification = notify(owner, "Личное");

        assertThat(mvc.post().uri("/api/me/notifications/" + notification.id() + "/read")
                .with(TestUsers.student(stranger)))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("notification.not-found");
        assertThat(mvc.get().uri("/api/me/notifications").with(TestUsers.student(stranger)))
                .hasStatusOk()
                .bodyJson().extractingPath("$.total").isEqualTo(0);
    }

    @Test
    void rejectsInvalidPaging() {
        UUID student = directory.addStudent("Листатель");

        assertThat(mvc.get().uri("/api/me/notifications?size=500").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(mvc.get().uri("/api/me/notifications?page=-1").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void requiresAuthentication() {
        assertThat(mvc.get().uri("/api/me/notifications")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void teacherWritesToChosenStudents() {
        UUID chosen = directory.addStudent("Избранный");
        UUID other = directory.addStudent("Другой");

        assertThat(mvc.post().uri("/api/teacher/notifications/broadcast").with(TestUsers.teacher(directory.teacherId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title": "Занятие переносится", "body": "Встречаемся в четверг", "studentIds": ["%s"]}
                        """.formatted(chosen)))
                .hasStatusOk()
                .bodyJson().extractingPath("$.recipients").isEqualTo(1);

        List<InboxNotification> received = inbox.findPage(chosen, 0, 10);
        assertThat(received).singleElement().satisfies(n -> {
            assertThat(n.kind()).isEqualTo(NotificationKind.MESSAGE);
            assertThat(n.title()).isEqualTo("Занятие переносится");
            assertThat(n.body()).isEqualTo("Встречаемся в четверг");
            assertThat(n.link()).isNull();
        });
        assertThat(inbox.findPage(other, 0, 10)).isEmpty();
    }

    @Test
    void teacherWritesToAllCurrentStudents() {
        UUID active = directory.addStudent("Активный");
        UUID invited = directory.addStudent("Приглашённый", StudentStatus.INVITED);
        UUID gone = directory.addStudent("Ушедший", StudentStatus.DEACTIVATED);

        int recipients = notifications.broadcast("Всем привет", null, List.of());

        assertThat(recipients).isEqualTo(directory.currentStudents().size());
        assertThat(inbox.findPage(active, 0, 10)).hasSize(1);
        assertThat(inbox.findPage(invited, 0, 10)).hasSize(1);
        assertThat(inbox.findPage(gone, 0, 10)).isEmpty();
    }

    @Test
    void broadcastValidatesStudentsAndText() {
        UUID gone = directory.addStudent("Бывший", StudentStatus.DEACTIVATED);
        UUID teacher = directory.teacherId();

        assertThat(mvc.post().uri("/api/teacher/notifications/broadcast").with(TestUsers.teacher(teacher))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\": \"Привет\", \"studentIds\": [\"%s\"]}".formatted(gone)))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("student.not-found");
        assertThat(mvc.post().uri("/api/teacher/notifications/broadcast").with(TestUsers.teacher(teacher))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\": \"  \"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThatThrownBy(() -> notifications.broadcast("Привет", null, List.of(UUID.randomUUID())))
                .hasMessageContaining("not found");
    }

    @Test
    void broadcastIsForTheTeacherOnly() {
        UUID student = directory.addStudent("Самозванец");

        assertThat(mvc.post().uri("/api/teacher/notifications/broadcast").with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\": \"Привет\"}"))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void validatesNotificationText() {
        UUID student = directory.addStudent("Проверка");

        assertThatThrownBy(() -> notify(student, " "))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Title");
        assertThatThrownBy(() -> notifications.notify(student, NotificationKind.MESSAGE, "Тема", "x".repeat(4001), null))
                .isInstanceOf(BusinessRuleException.class);
        InboxNotification blankBody = notifications.notify(student, NotificationKind.MESSAGE, " Тема ", "  ", null);
        assertThat(blankBody.title()).isEqualTo("Тема");
        assertThat(blankBody.body()).isNull();
    }

    private InboxNotification notify(UUID recipient, String title) {
        return notifications.notify(recipient, NotificationKind.MESSAGE, title, null, null);
    }
}

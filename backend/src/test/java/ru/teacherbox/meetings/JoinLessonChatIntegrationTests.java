package ru.teacherbox.meetings;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.testing.ChatSteps.action;
import static ru.teacherbox.testing.ChatSteps.done;
import static ru.teacherbox.testing.ChatSteps.url;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.teacherbox.meetings.application.RoomService;
import ru.teacherbox.meetings.domain.RoomOwner;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.security.Role;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;

/** The links to a student's video rooms in the messenger bot (ADR-0013). */
@MeetingsIntegrationTest
class JoinLessonChatIntegrationTests {

    @Autowired
    List<ChatAction> actions;

    @Autowired
    RoomService rooms;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Test
    void givesTheLinksOfTheStudentsRooms() {
        UUID student = directory.addStudent("Олег");
        ChatUser user = new ChatUser(student, Role.STUDENT);
        ChatAction join = action(actions, "meetings.join");
        assertThat(join.availableTo(user)).isTrue();
        assertThat(join.availableTo(new ChatUser(directory.teacherId(), Role.TEACHER))).isFalse();
        assertThat(done(join.start(user)).reply().text()).startsWith("Ссылки на видеовстречу пока нет");

        rooms.enter(RoomOwner.STUDENT, student, "https://telemost.yandex.ru/j/1");
        ChatStep one = done(join.start(user));
        assertThat(one.reply().text()).isEqualTo("Ссылка на урок:");
        assertThat(url(one, "Войти на урок")).isEqualTo("https://telemost.yandex.ru/j/1");

        UUID group = groups.addGroup("ОГЭ", student);
        rooms.enter(RoomOwner.GROUP, group, "https://zoom.us/j/2");
        ChatStep both = done(join.next(user, ChatState.EMPTY, new ChatInput.Text("?")));
        assertThat(both.reply().text()).isEqualTo("Ссылки на уроки:");
        assertThat(url(both, "Группа «ОГЭ»")).isEqualTo("https://zoom.us/j/2");
    }
}

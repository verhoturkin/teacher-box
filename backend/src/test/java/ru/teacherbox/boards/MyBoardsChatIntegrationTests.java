package ru.teacherbox.boards;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.testing.ChatSteps.action;
import static ru.teacherbox.testing.ChatSteps.done;
import static ru.teacherbox.testing.ChatSteps.url;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.teacherbox.boards.application.BoardService;
import ru.teacherbox.boards.domain.BoardOwner;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.security.Role;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;

/** A student's boards in the messenger bot (ADR-0013). */
@BoardsIntegrationTest
class MyBoardsChatIntegrationTests {

    @Autowired
    List<ChatAction> actions;

    @Autowired
    BoardService boards;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Test
    void givesTheLinksOfTheStudentsBoards() {
        UUID student = directory.addStudent("Полина");
        ChatUser user = new ChatUser(student, Role.STUDENT);
        ChatAction mine = action(actions, "boards.mine");
        assertThat(mine.availableTo(user)).isTrue();
        assertThat(mine.availableTo(new ChatUser(directory.teacherId(), Role.TEACHER))).isFalse();
        assertThat(done(mine.start(user)).reply().text()).isEqualTo("Досок пока нет.");

        boards.add(BoardOwner.STUDENT, student, "Алгебра", "https://app.holst.so/board/1");
        UUID group = groups.addGroup("ОГЭ", student);
        boards.add(BoardOwner.GROUP, group, "Общая", "https://app.holst.so/board/2");

        ChatStep shown = done(mine.next(user, ChatState.EMPTY, new ChatInput.Text("?")));
        assertThat(shown.reply().text()).isEqualTo("Ваши доски:");
        assertThat(url(shown, "Алгебра")).isEqualTo("https://app.holst.so/board/1");
        assertThat(url(shown, "Общая · ОГЭ")).isEqualTo("https://app.holst.so/board/2");
    }
}

package ru.teacherbox.boards;

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
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** Boards of students and groups through the teacher's and the student's API. */
@BoardsIntegrationTest
class BoardsIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Test
    void theTeacherLinksBoardsToStudentsAndGroups() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID group = groups.addGroup("ОГЭ", anna);

        MvcTestResult own = post("""
                {"studentId":"%s","title":" Алгебра ","url":"https://app.holst.so/board/1"}""".formatted(anna));
        assertThat(own).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.title").isEqualTo("Алгебра");
            assertThat(json).extractingPath("$.ownerName").isEqualTo("Анна");
            assertThat(json).extractingPath("$.ownerType").isEqualTo("STUDENT");
            assertThat(json).extractingPath("$.holst").isEqualTo(true);
        });
        assertThat(post("{\"groupId\":\"%s\",\"url\":\"https://miro.com/b/2\"}".formatted(group)))
                .hasStatus(HttpStatus.CREATED).bodyJson().extractingPath("$.title").isEqualTo("Доска");

        assertThat(mvc.get().uri("/api/teacher/boards").with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$[?(@.ownerId == '" + group + "')].ownerName").asArray().containsExactly("ОГЭ");
        assertThat(mvc.get().uri("/api/me/boards").with(TestUsers.student(anna))).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$[*].title").asArray().containsExactly("Алгебра", "Доска");
                    assertThat(json).extractingPath("$[1].groupName").isEqualTo("ОГЭ");
                });
        UUID stranger = directory.addStudent("Чужой");
        assertThat(mvc.get().uri("/api/me/boards").with(TestUsers.student(stranger))).hasStatusOk()
                .bodyJson().extractingPath("$").asArray().isEmpty();

        String id = JsonPath.read(own.getResponse().getContentAsString(), "$.id");
        assertThat(put(id, "{\"title\":\"Геометрия\",\"url\":\"https://app.holst.so/board/3\",\"version\":0}"))
                .hasStatusOk().bodyJson().extractingPath("$.version").isEqualTo(1);
        assertThat(put(id, "{\"title\":\"Старое\",\"url\":\"https://app.holst.so/board/3\",\"version\":0}"))
                .hasStatus(HttpStatus.CONFLICT);
        assertThat(mvc.delete().uri("/api/teacher/boards/" + id).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.delete().uri("/api/teacher/boards/" + id).with(teacher())).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(put(id, "{\"title\":\"x\",\"url\":\"https://x.ru\",\"version\":1}"))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code").isEqualTo("boards.board-not-found");
    }

    @Test
    void checksOwnersLinksAndLimits() {
        UUID gone = directory.addStudent("Ушёл", StudentStatus.DEACTIVATED);
        UUID archived = groups.addGroup("Архив");
        groups.archive(archived);
        UUID vera = directory.addStudent("Вера");

        assertThat(post("{\"studentId\":\"%s\",\"url\":\"https://holst.so/b\"}".formatted(gone)))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code").isEqualTo("boards.student-not-found");
        assertThat(post("{\"groupId\":\"%s\",\"url\":\"https://holst.so/b\"}".formatted(archived)))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code").isEqualTo("boards.group-not-found");
        assertThat(post("{\"url\":\"https://holst.so/b\"}")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("boards.owner-invalid");
        assertThat(post("{\"studentId\":\"%s\",\"url\":\"holst\"}".formatted(vera)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("boards.link-invalid");
        for (int index = 0; index < 20; index++) {
            assertThat(post("{\"studentId\":\"%s\",\"url\":\"https://holst.so/b/%d\"}".formatted(vera, index)))
                    .hasStatus(HttpStatus.CREATED);
        }
        assertThat(post("{\"studentId\":\"%s\",\"url\":\"https://holst.so/b/21\"}".formatted(vera)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code").isEqualTo("boards.too-many");
    }

    @Test
    void onlyTheTeacherManagesAndOnlyStudentsHaveBoards() {
        UUID student = directory.addStudent("Любопытный");
        assertThat(mvc.get().uri("/api/teacher/boards").with(TestUsers.student(student))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/boards").with(teacher())).hasStatus(HttpStatus.FORBIDDEN);
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    private MvcTestResult post(String json) {
        return mvc.post().uri("/api/teacher/boards").with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content(json).exchange();
    }

    private MvcTestResult put(String id, String json) {
        return mvc.put().uri("/api/teacher/boards/" + id).with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content(json).exchange();
    }
}

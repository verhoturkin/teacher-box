package ru.teacherbox.boards;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.time.Duration;
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
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Boards with their students and groups through the teacher's and the student's API (ADR-0028). */
@BoardsIntegrationTest
class BoardsIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    MutableClock clock;

    @Test
    void theTeacherBindsABoardToStudentsAndGroups() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID group = groups.addGroup("ОГЭ", boris);

        MvcTestResult created = post("""
                {"kind":"EXCALIDRAW","title":" Алгебра ","url":"https://ignored.example",
                 "studentIds":["%s"],"groupIds":["%s"]}""".formatted(anna, group));
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.title").isEqualTo("Алгебра");
            assertThat(json).extractingPath("$.kind").isEqualTo("EXCALIDRAW");
            assertThat(json).extractingPath("$.url").isNull();
            assertThat(json).extractingPath("$.members[*].name").asArray().containsExactly("Анна", "ОГЭ");
            assertThat(json).extractingPath("$.members[*].type").asArray().containsExactly("STUDENT", "GROUP");
        });
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        clock.advance(Duration.ofMinutes(1));
        MvcTestResult external = post("""
                {"kind":"LINK","title":"Холст","url":"https://app.holst.so/board/1","studentIds":["%s"]}"""
                .formatted(boris));
        assertThat(external).hasStatus(HttpStatus.CREATED).bodyJson().extractingPath("$.url")
                .isEqualTo("https://app.holst.so/board/1");

        assertThat(mvc.get().uri("/api/teacher/boards").with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$[?(@.id == '" + id + "')].members[*].id").asArray()
                .containsExactly(anna.toString(), group.toString());
        assertThat(mvc.get().uri("/api/teacher/boards?groupId=" + group).with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$[*].title").asArray().containsExactly("Алгебра");
        assertThat(mvc.get().uri("/api/teacher/boards?studentId=" + boris).with(teacher())).as("with the group's")
                .hasStatusOk().bodyJson().extractingPath("$[*].title").asArray().containsExactly("Алгебра", "Холст");
        assertThat(mvc.get().uri("/api/teacher/boards?studentId=" + anna).with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$[*].title").asArray().containsExactly("Алгебра");
        assertThat(mvc.get().uri("/api/teacher/boards?studentId=" + anna + "&studentId=" + boris).with(teacher()))
                .as("the boards of an assignment's students").hasStatusOk().bodyJson()
                .extractingPath("$[*].title").asArray().containsExactly("Алгебра", "Холст");

        assertThat(mvc.get().uri("/api/me/boards").with(TestUsers.student(boris))).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$[*].title").asArray().containsExactly("Холст", "Алгебра");
                    assertThat(json).extractingPath("$[0].groupNames").asArray().isEmpty();
                    assertThat(json).extractingPath("$[1].groupNames").asArray().containsExactly("ОГЭ");
                    assertThat(json).extractingPath("$[1].kind").isEqualTo("EXCALIDRAW");
                });
        UUID stranger = directory.addStudent("Чужой");
        assertThat(mvc.get().uri("/api/me/boards").with(TestUsers.student(stranger))).hasStatusOk()
                .bodyJson().extractingPath("$").asArray().isEmpty();

        assertThat(put(id, """
                {"title":"Геометрия","studentIds":[],"groupIds":["%s"],"version":0}""".formatted(group)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.version").isEqualTo(1);
                    assertThat(json).extractingPath("$.members[*].name").asArray().containsExactly("ОГЭ");
                });
        assertThat(put(id, "{\"title\":\"Старое\",\"version\":0}")).hasStatus(HttpStatus.CONFLICT);
        assertThat(mvc.get().uri("/api/me/boards").with(TestUsers.student(anna))).hasStatusOk()
                .bodyJson().extractingPath("$").asArray().isEmpty();

        assertThat(mvc.delete().uri("/api/teacher/boards/" + id).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.delete().uri("/api/teacher/boards/" + id).with(teacher())).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(put(id, "{\"title\":\"x\",\"version\":1}"))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code").isEqualTo("boards.board-not-found");
    }

    @Test
    void newMembersMustBeCurrentStudentsAndActiveGroups() throws UnsupportedEncodingException {
        UUID gone = directory.addStudent("Ушёл", StudentStatus.DEACTIVATED);
        UUID archived = groups.addGroup("Архив");
        groups.archive(archived);
        UUID vera = directory.addStudent("Вера");

        assertThat(post("{\"kind\":\"EXCALIDRAW\",\"title\":\"Д\",\"studentIds\":[\"%s\"]}".formatted(gone)))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code").isEqualTo("boards.student-not-found");
        assertThat(post("{\"kind\":\"EXCALIDRAW\",\"title\":\"Д\",\"groupIds\":[\"%s\"]}".formatted(archived)))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code").isEqualTo("boards.group-not-found");
        assertThat(post("{\"kind\":\"LINK\",\"title\":\"Д\",\"url\":\"holst\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("boards.link-invalid");
        assertThat(post("{\"title\":\"Д\"}")).hasStatus(HttpStatus.BAD_REQUEST);

        MvcTestResult created = post("{\"kind\":\"EXCALIDRAW\",\"title\":\"Д\",\"studentIds\":[\"%s\"]}"
                .formatted(vera));
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        directory.setStatus(vera, StudentStatus.DEACTIVATED);
        assertThat(put(id, "{\"title\":\"Д2\",\"studentIds\":[\"%s\"],\"version\":0}".formatted(vera)))
                .as("a member the board already has stays").hasStatusOk();
        assertThat(put(id, "{\"title\":\"Д3\",\"studentIds\":[\"%s\"],\"version\":1}".formatted(gone)))
                .hasStatus(HttpStatus.NOT_FOUND);
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

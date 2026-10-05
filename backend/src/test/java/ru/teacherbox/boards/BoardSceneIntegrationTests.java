package ru.teacherbox.boards;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** The editor's API: opening, saving with a merge, polling, images and who may do it (ADR-0028). */
@BoardsIntegrationTest
class BoardSceneIntegrationTests {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 13, 'I', 'H', 'D', 'R'};

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Test
    void twoEditorsSaveAtOnceAndBothChangesStay() {
        UUID student = directory.addStudent("Соавтор");
        String id = board("{\"kind\":\"EXCALIDRAW\",\"title\":\"Вместе\",\"studentIds\":[\"%s\"]}".formatted(student));
        RequestPostProcessor pupil = TestUsers.student(student);

        assertThat(mvc.get().uri("/api/boards/" + id).with(pupil)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.title").isEqualTo("Вместе");
            assertThat(json).extractingPath("$.sceneVersion").isEqualTo(0);
            assertThat(json).extractingPath("$.elements").asArray().isEmpty();
        });
        assertThat(save(teacher(), id, element("t", 1, 1), "{\"viewBackgroundColor\":\"#fff\",\"zoom\":2}", 0))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.sceneVersion").isEqualTo(1);
                    assertThat(json).extractingPath("$.appState.viewBackgroundColor").isEqualTo("#fff");
                    assertThat(json).doesNotHavePath("$.appState.zoom");
                });
        // the student still has version 0 and saves a shape of their own
        assertThat(save(pupil, id, element("s", 1, 1), null, 0)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.sceneVersion").isEqualTo(2);
            assertThat(json).extractingPath("$.elements[*].id").asArray().containsExactly("t", "s");
            assertThat(json).extractingPath("$.appState.viewBackgroundColor").isEqualTo("#fff");
        });
        assertThat(save(teacher(), id, element("s", 1, 1), null, 2)).as("nothing new: the version stays")
                .hasStatusOk().bodyJson().extractingPath("$.sceneVersion").isEqualTo(2);

        assertThat(mvc.get().uri("/api/boards/" + id + "/scene?since=2").with(teacher()))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri("/api/boards/" + id + "/scene?since=1").with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$.elements[*].id").asArray().containsExactly("t", "s");
        assertThat(save(teacher(), id, "[{\"id\":\"x\"}]", null, 2)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("boards.scene-invalid");
    }

    @Test
    void onlyTheBoardsStudentsOpenIt() {
        UUID member = directory.addStudent("Участник");
        UUID inGroup = directory.addStudent("Из группы");
        UUID stranger = directory.addStudent("Посторонний");
        UUID group = groups.addGroup("Группа", inGroup);
        String id = board("{\"kind\":\"EXCALIDRAW\",\"title\":\"Своя\",\"studentIds\":[\"%s\"],\"groupIds\":[\"%s\"]}"
                .formatted(member, group));

        assertThat(mvc.get().uri("/api/boards/" + id).with(TestUsers.student(member))).hasStatusOk();
        assertThat(mvc.get().uri("/api/boards/" + id).with(TestUsers.student(inGroup))).hasStatusOk();
        assertThat(save(TestUsers.student(inGroup), id, element("g", 1, 1), null, 0)).hasStatusOk();
        assertThat(mvc.get().uri("/api/boards/" + id).with(TestUsers.student(stranger)))
                .as("another student gets 404").hasStatus(HttpStatus.NOT_FOUND);
        assertThat(save(TestUsers.student(stranger), id, element("x", 1, 1), null, 0))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/boards/" + id + "/scene?since=0").with(TestUsers.student(stranger)))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/boards/" + id).with(TestUsers.admin(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);

        groups.setMembers(group, List.of());
        assertThat(mvc.get().uri("/api/boards/" + id).with(TestUsers.student(inGroup)))
                .as("left the group — no access").hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/boards/" + UUID.randomUUID()).with(teacher())).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void anExternalBoardHasNoScene() {
        String id = board("{\"kind\":\"LINK\",\"title\":\"Холст\",\"url\":\"https://app.holst.so/board/7\"}");

        assertThat(mvc.get().uri("/api/boards/" + id).with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$.kind").isEqualTo("LINK");
        assertThat(save(teacher(), id, "[]", null, 0)).hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("boards.no-scene");
        assertThat(mvc.get().uri("/api/boards/" + id + "/scene?since=0").with(teacher()))
                .hasStatus(HttpStatus.CONFLICT);
        assertThat(upload(teacher(), id, "f1", "image/png", PNG)).hasStatus(HttpStatus.CONFLICT);
    }

    @Test
    void imagesAreStoredOnceAndServedForAYear() {
        UUID student = directory.addStudent("Художник");
        String id = board("{\"kind\":\"EXCALIDRAW\",\"title\":\"Картинки\",\"studentIds\":[\"%s\"]}".formatted(student));

        assertThat(upload(TestUsers.student(student), id, "abc123", "image/png", PNG)).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(upload(teacher(), id, "abc123", "image/png", "other".getBytes(StandardCharsets.US_ASCII)))
                .as("the same id again changes nothing").hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri("/api/boards/" + id + "/files/abc123").with(teacher())).hasStatusOk()
                .hasContentType("image/png")
                .hasHeader("Cache-Control", "max-age=31536000, private, immutable")
                .hasHeader("X-Content-Type-Options", "nosniff")
                .body().isEqualTo(PNG);

        assertThat(upload(teacher(), id, "svg", "image/svg+xml", "<svg/>".getBytes(StandardCharsets.US_ASCII)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("boards.file-type-not-allowed");
        assertThat(upload(teacher(), id, "bad.id", "image/png", PNG)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(mvc.get().uri("/api/boards/" + id + "/files/missing").with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND);
        UUID stranger = directory.addStudent("Чужой");
        assertThat(mvc.get().uri("/api/boards/" + id + "/files/abc123").with(TestUsers.student(stranger)))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(upload(TestUsers.student(stranger), id, "f2", "image/png", PNG)).hasStatus(HttpStatus.NOT_FOUND);

        assertThat(mvc.delete().uri("/api/teacher/boards/" + id).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri("/api/boards/" + id + "/files/abc123").with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    static String element(String id, int version, int nonce) {
        return "[{\"id\":\"%s\",\"type\":\"rectangle\",\"version\":%d,\"versionNonce\":%d}]".formatted(id, version,
                nonce);
    }

    private String board(String json) {
        MvcTestResult created = mvc.post().uri("/api/teacher/boards").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content(json).exchange();
        assertThat(created).hasStatus(HttpStatus.CREATED);
        try {
            return JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }

    private MvcTestResult save(RequestPostProcessor user, String id, String elements, String appState,
            long baseVersion) {
        return mvc.put().uri("/api/boards/" + id + "/scene").with(user).contentType(MediaType.APPLICATION_JSON)
                .content("{\"elements\":%s,\"appState\":%s,\"baseVersion\":%d}".formatted(elements, appState,
                        baseVersion))
                .exchange();
    }

    private MvcTestResult upload(RequestPostProcessor user, String id, String fileId, String type, byte[] content) {
        return mvc.put().uri("/api/boards/" + id + "/files/" + fileId).with(user).contentType(type).content(content)
                .exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}

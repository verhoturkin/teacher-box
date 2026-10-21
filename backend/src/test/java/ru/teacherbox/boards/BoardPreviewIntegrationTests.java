package ru.teacherbox.boards;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Objects;
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
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The preview picture of a board: the editor uploads it on save, the teacher and the board's students read it. */
@BoardsIntegrationTest
class BoardPreviewIntegrationTests {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 13, 'I', 'H', 'D', 'R'};

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    MutableClock clock;

    @Test
    void theTeacherUploadsAPreviewAndTheBoardsStudentsReadIt() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID group = groups.addGroup("ОГЭ", boris);
        String id = board("{\"kind\":\"EXCALIDRAW\",\"title\":\"П\",\"studentIds\":[\"%s\"],\"groupIds\":[\"%s\"]}"
                .formatted(anna, group));

        assertThat(mvc.get().uri("/api/boards/" + id + "/preview").with(teacher())).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("boards.preview-not-found");
        assertThat(mvc.get().uri("/api/teacher/boards").with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$[?(@.id == '" + id + "')].previewUpdatedAt").asArray().allMatch(Objects::isNull);

        assertThat(putPreview(teacher(), id, "image/png", PNG)).hasStatus(HttpStatus.NO_CONTENT);
        clock.advance(Duration.ofMinutes(1));
        assertThat(putPreview(teacher(), id, "image/png", PNG)).as("replaced").hasStatus(HttpStatus.NO_CONTENT);

        for (RequestPostProcessor reader : new RequestPostProcessor[] {teacher(), TestUsers.student(anna),
                TestUsers.student(boris)}) {
            MvcTestResult read = mvc.get().uri("/api/boards/" + id + "/preview").with(reader).exchange();
            assertThat(read).hasStatusOk().hasContentType(MediaType.IMAGE_PNG)
                    .hasHeader("X-Content-Type-Options", "nosniff");
            assertThat(read.getResponse().getContentAsByteArray()).isEqualTo(PNG);
        }
        assertThat(mvc.get().uri("/api/teacher/boards").with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$[?(@.id == '" + id + "')].previewUpdatedAt").asArray().hasSize(1)
                .doesNotContainNull();
        assertThat(mvc.get().uri("/api/me/boards").with(TestUsers.student(anna))).hasStatusOk().bodyJson()
                .extractingPath("$[0].previewUpdatedAt").isNotNull();

        assertThat(mvc.delete().uri("/api/teacher/boards/" + id).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri("/api/boards/" + id + "/preview").with(teacher())).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("boards.board-not-found");
    }

    @Test
    void anotherStudentGetsNotFoundAndOnlyTheTeacherUploads() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID stranger = directory.addStudent("Чужой");
        String id = board("{\"kind\":\"EXCALIDRAW\",\"title\":\"П\",\"studentIds\":[\"%s\"]}".formatted(anna));
        assertThat(putPreview(teacher(), id, "image/png", PNG)).hasStatus(HttpStatus.NO_CONTENT);

        assertThat(mvc.get().uri("/api/boards/" + id + "/preview").with(TestUsers.student(stranger)))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(putPreview(TestUsers.student(anna), id, "image/png", PNG)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(putPreview(TestUsers.student(stranger), id, "image/png", PNG)).hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void onlyAPngOfAnExcalidrawBoardWithinTheLimitIsTaken() throws UnsupportedEncodingException {
        String id = board("{\"kind\":\"EXCALIDRAW\",\"title\":\"П\"}");
        String link = board("{\"kind\":\"LINK\",\"title\":\"Л\",\"url\":\"https://miro.com/b\"}");

        assertThat(putPreview(teacher(), id, "image/png", "<svg/>".getBytes(StandardCharsets.US_ASCII)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("boards.file-type-not-allowed");
        assertThat(putPreview(teacher(), id, "image/jpeg", PNG)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(putPreview(teacher(), id, "image/png", new byte[5 * 1024 * 1024 + 1]))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("boards.file-too-large");
        assertThat(putPreview(teacher(), link, "image/png", PNG)).hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("boards.no-scene");
        assertThat(putPreview(teacher(), UUID.randomUUID().toString(), "image/png", PNG))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    private String board(String json) throws UnsupportedEncodingException {
        MvcTestResult created = mvc.post().uri("/api/teacher/boards").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content(json).exchange();
        return JsonPath.read(created.getResponse().getContentAsString(), "$.id");
    }

    private MvcTestResult putPreview(RequestPostProcessor user, String id, String type, byte[] content) {
        return mvc.put().uri("/api/teacher/boards/" + id + "/preview").with(user).contentType(type).content(content)
                .exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}

package ru.teacherbox.boards;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.boards.BoardSceneIntegrationTests.element;

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
import ru.teacherbox.boards.application.BoardBackupService;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Copies of a board: the teacher's, the daily ones, restoring and the images they keep (ADR-0028). */
@BoardsIntegrationTest
class BoardBackupsIntegrationTests {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 13};

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @Autowired
    BoardBackupService backups;

    @Test
    void theTeacherCopiesChangesAndRestoresABoard() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Копия");
        String id = board();
        assertThat(save(id, element("a", 1, 1), 0)).hasStatusOk();

        MvcTestResult copy = mvc.post().uri(backupsUri(id)).with(teacher()).exchange();
        assertThat(copy).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.kind").isEqualTo("MANUAL");
            assertThat(json).extractingPath("$.sceneVersion").isEqualTo(1);
        });
        String copyId = JsonPath.read(copy.getResponse().getContentAsString(), "$.id");
        clock.advance(Duration.ofMinutes(5));
        assertThat(save(id, element("a", 5, 1).replace("]", ",{\"id\":\"b\",\"version\":1,\"versionNonce\":1}]"), 1))
                .hasStatusOk();

        MvcTestResult restored = mvc.post().uri(backupsUri(id) + "/" + copyId + "/restore").with(teacher()).exchange();
        assertThat(restored).hasStatusOk().bodyJson().extractingPath("$.sceneVersion").isEqualTo(2);
        assertThat(mvc.get().uri("/api/boards/" + id + "/scene?since=2").with(teacher())).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.sceneVersion").isEqualTo(3);
                    assertThat(json).extractingPath("$.elements[0].version").isEqualTo(6);
                    assertThat(json).extractingPath("$.elements[1].isDeleted").isEqualTo(true);
                });
        assertThat(mvc.get().uri(backupsUri(id)).with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$[*].sceneVersion").asArray().containsExactly(2, 1);

        assertThat(mvc.delete().uri(backupsUri(id) + "/" + copyId).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.delete().uri(backupsUri(id) + "/" + copyId).with(teacher())).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("boards.backup-not-found");
        assertThat(mvc.post().uri(backupsUri(id) + "/" + copyId + "/restore").with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri(backupsUri(id)).with(TestUsers.student(student))).hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void theTeachersCopiesAreLimited() {
        String id = board();
        for (int index = 0; index < 20; index++) {
            assertThat(mvc.post().uri(backupsUri(id)).with(teacher())).hasStatus(HttpStatus.CREATED);
        }
        assertThat(mvc.post().uri(backupsUri(id)).with(teacher())).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("boards.too-many-backups");
        MvcTestResult external = mvc.post().uri("/api/teacher/boards").with(teacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"kind\":\"LINK\",\"title\":\"Ссылка\",\"url\":\"https://miro.com/b/1\"}").exchange();
        assertThat(mvc.get().uri(backupsUri(id(external))).with(teacher())).hasStatus(HttpStatus.CONFLICT);
    }

    @Test
    void dailyCopiesOfChangedBoardsKeepTheirImages() {
        String id = board();
        backups.dailyCopies();
        assertThat(mvc.get().uri(backupsUri(id)).with(teacher())).as("a board never saved is not copied")
                .hasStatusOk().bodyJson().extractingPath("$").asArray().isEmpty();

        assertThat(upload(id, "used")).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(upload(id, "orphan")).hasStatus(HttpStatus.NO_CONTENT);
        String image = "[{\"id\":\"i\",\"type\":\"image\",\"fileId\":\"used\",\"version\":%d,\"versionNonce\":1}]";
        for (int day = 1; day <= 9; day++) {
            assertThat(save(id, image.formatted(day), day - 1)).hasStatusOk();
            clock.advance(Duration.ofDays(1));
            assertThat(backups.dailyCopies()).isGreaterThanOrEqualTo(1);
        }
        assertThat(backups.dailyCopies()).as("nothing changed since the last copy").isZero();

        assertThat(mvc.get().uri(backupsUri(id)).with(teacher())).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$").asArray().hasSize(7);
            assertThat(json).extractingPath("$[*].kind").asArray().containsOnly("DAILY");
            assertThat(json).extractingPath("$[0].sceneVersion").isEqualTo(9);
        });
        assertThat(mvc.get().uri("/api/boards/" + id + "/files/used").with(teacher())).hasStatusOk();
        assertThat(mvc.get().uri("/api/boards/" + id + "/files/orphan").with(teacher()))
                .as("an image no scene or copy refers to is deleted").hasStatus(HttpStatus.NOT_FOUND);
    }

    private String board() {
        return id(mvc.post().uri("/api/teacher/boards").with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"kind\":\"EXCALIDRAW\",\"title\":\"С копиями\"}").exchange());
    }

    private static String id(MvcTestResult created) {
        assertThat(created).hasStatus(HttpStatus.CREATED);
        try {
            return JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }

    private MvcTestResult save(String id, String elements, long baseVersion) {
        return mvc.put().uri("/api/boards/" + id + "/scene").with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"elements\":%s,\"baseVersion\":%d}".formatted(elements, baseVersion)).exchange();
    }

    private MvcTestResult upload(String id, String fileId) {
        return mvc.put().uri("/api/boards/" + id + "/files/" + fileId).with(teacher()).contentType("image/png")
                .content(PNG).exchange();
    }

    private static String backupsUri(String id) {
        return "/api/teacher/boards/" + id + "/backups";
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}

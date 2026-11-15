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

    @Autowired
    ru.teacherbox.boards.persistence.SceneRepository scenes;

    @Test
    void prunedImageIsExcludedFromPortalBackupButKeptByABoardCopy() {
        String id = board();
        assertThat(upload(id, "retired-image")).hasStatus(HttpStatus.NO_CONTENT);
        String image = deleted("picture", 2).replace("\"type\":\"rectangle\"",
                "\"type\":\"image\",\"fileId\":\"retired-image\"");
        assertThat(save(id, image, 0)).hasStatusOk();
        String copy = id(mvc.post().uri(backupsUri(id)).with(teacher()).exchange());
        String key = scenes.findFile(UUID.fromString(id), "retired-image").orElseThrow().fileKey();
        assertThat(backups.filesOutsideScenes()).doesNotContain(key);
        clock.advance(Duration.ofDays(31));
        // Save-time pruning happens before a new daily copy, so only the manual copy holds the image.
        assertThat(save(id, "[]", 1)).hasStatusOk().bodyJson()
                .extractingPath("$.sceneChars").isEqualTo(2);
        assertThat(backups.filesOutsideScenes()).contains(key);
        assertThat(mvc.get().uri("/api/boards/" + id + "/files/retired-image").with(teacher())).hasStatusOk();
        assertThat(mvc.delete().uri(backupsUri(id) + "/" + copy).with(teacher()))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri("/api/boards/" + id + "/files/retired-image").with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void pruningOnSaveRefusesAnOfflineEditorsHigherVersionAndKeepsNewShapes() {
        String id = board();
        assertThat(save(id, element("gone", 1, 1), 0)).hasStatusOk();
        assertThat(save(id, deleted("gone", 2), 1)).hasStatusOk();
        clock.advance(Duration.ofDays(30));
        assertThat(save(id, "[]", 2)).hasStatusOk().bodyJson()
                .extractingPath("$.elements").asArray().hasSize(1);
        clock.advance(Duration.ofSeconds(1));
        String incoming = element("gone", 100, 1).replace("]", ","
                + element("new", 1, 1).substring(1));
        assertThat(save(id, incoming, 1)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.elements[*].id").asArray().containsExactly("new");
            assertThat(json).extractingPath("$.rejectedElementIds").asArray().containsExactly("gone");
        });
        // Knowing the latest scene version must not bypass the retained deletion identity.
        assertThat(save(id, element("gone", 101, 1), 3)).hasStatusOk().bodyJson()
                .extractingPath("$.elements[*].id").asArray().containsExactly("new");
    }

    @Test
    void nightlyPruningAlsoVisitsUnchangedBoardsAndRestoreCanRecoverRetiredElements() {
        String id = board();
        assertThat(save(id, element("a", 1, 1), 0)).hasStatusOk();
        String copy = id(mvc.post().uri(backupsUri(id)).with(teacher()).exchange());
        assertThat(save(id, deleted("a", 9), 1)).hasStatusOk();
        backups.dailyCopies();
        clock.advance(Duration.ofDays(31));
        backups.dailyCopies();
        assertThat(mvc.get().uri("/api/boards/" + id).with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$.elements").asArray().isEmpty();
        assertThat(save(id, element("b", 1, 1), 3)).hasStatusOk();
        assertThat(mvc.post().uri(backupsUri(id) + "/" + copy + "/restore").with(teacher()))
                .hasStatusOk();
        assertThat(mvc.get().uri("/api/boards/" + id).with(teacher())).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.elements[0].id").isEqualTo("a");
                    assertThat(json).extractingPath("$.elements[0].version").isEqualTo(10);
                    assertThat(json).extractingPath("$.elements[1].id").isEqualTo("b");
                    assertThat(json).extractingPath("$.elements[1].isDeleted").isEqualTo(true);
                });
        assertThat(save(id, element("a", 11, 1), 5)).hasStatusOk().bodyJson()
                .extractingPath("$.rejectedElementIds").asArray().isEmpty();
    }

    @Test
    void undoWithinRetentionStartsANewDeletionPeriod() {
        String id = board();
        assertThat(save(id, deleted("a", 1), 0)).hasStatusOk();
        clock.advance(Duration.ofDays(29));
        assertThat(save(id, element("a", 2, 1), 1)).hasStatusOk();
        assertThat(save(id, deleted("a", 3), 2)).hasStatusOk();
        clock.advance(Duration.ofDays(2));
        backups.dailyCopies();
        assertThat(mvc.get().uri("/api/boards/" + id).with(teacher())).hasStatusOk().bodyJson()
                .extractingPath("$.elements").asArray().hasSize(1);
    }

    private static String deleted(String id, int version) {
        return element(id, version, 1).replace("}]", ",\"isDeleted\":true,\"updated\":0}]");
    }

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

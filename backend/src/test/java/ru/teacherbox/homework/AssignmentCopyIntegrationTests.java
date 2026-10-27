package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.testing.FakeTextbooks;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;
import ru.teacherbox.textbooks.api.TextbookFormat;

/** A copy of an assignment: a new draft with the materials and without the students, the deadline and the board. */
@HomeworkIntegrationTest
class AssignmentCopyIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeTextbooks textbooks;

    @Test
    void copiesTheMaterialsOfTheAssignmentIntoADraft() throws Exception {
        UUID student = directory.addStudent("Анна");
        UUID spotlight = textbooks.add("Spotlight", TextbookFormat.PDF, 120);
        MvcTestResult created = mvc.post().uri("/api/teacher/homework/assignments").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content("""
                        {"title":"Дроби","description":"Решить **№1-5**","dueAt":"2030-01-10T15:00:00Z",
                         "studentIds":["%s"],
                         "videos":[{"url":"https://youtu.be/dQw4w9WgXcQ","title":"Песня",
                                    "transcript":"[0:18] Hello","transcriptShown":true}]}
                        """.formatted(student)).exchange();
        String id = JsonPath.read(AssignmentIntegrationTests.body(created), "$.id");
        String base = "/api/teacher/homework/assignments/" + id;
        assertThat(mvc.post().uri(base + "/textbooks").with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"textbookId\":\"%s\",\"pages\":\"3-5\"}".formatted(spotlight))).hasStatusOk();
        assertThat(mvc.put().uri(base + "/board").with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"boardId\":\"%s\"}".formatted(UUID.randomUUID()))).hasStatusOk();
        assertThat(mvc.post().uri(base + "/attachments").with(teacher()).multipart()
                .file(new MockMultipartFile("files", "Задачи.pdf", "application/octet-stream",
                        "%PDF-1.4 test".getBytes(StandardCharsets.UTF_8)))
                .exchange()).hasStatus(HttpStatus.CREATED);
        String originalFile = JsonPath.read(
                AssignmentIntegrationTests.body(mvc.get().uri(base).with(teacher()).exchange()),
                "$.attachments[0].id");

        MvcTestResult copy = mvc.post().uri(base + "/copy").with(teacher()).exchange();

        assertThat(copy).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.title").isEqualTo("Дроби (копия)");
            assertThat(json).extractingPath("$.description").isEqualTo("Решить **№1-5**");
            assertThat(json).extractingPath("$.dueAt").isNull();
            assertThat(json).extractingPath("$.boardId").isNull();
            assertThat(json).extractingPath("$.tasks.length()").isEqualTo(0);
            assertThat(json).extractingPath("$.attachments[0].filename").isEqualTo("Задачи.pdf");
            assertThat(json).extractingPath("$.textbooks[0].title").isEqualTo("Spotlight");
            assertThat(json).extractingPath("$.textbooks[0].pages").isEqualTo("3-5");
            assertThat(json).extractingPath("$.videos[0].title").isEqualTo("Песня");
            assertThat(json).extractingPath("$.videos[0].transcript").isEqualTo("[0:18] Hello");
            assertThat(json).extractingPath("$.videos[0].transcriptShown").isEqualTo(true);
        });
        String copyId = JsonPath.read(AssignmentIntegrationTests.body(copy), "$.id");
        String copyFile = JsonPath.read(AssignmentIntegrationTests.body(copy), "$.attachments[0].id");
        assertThat(copyId).isNotEqualTo(id);
        assertThat(copyFile).isNotEqualTo(originalFile);

        assertThat(mvc.delete().uri(base).with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri("/api/teacher/homework/attachments/" + originalFile).with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/teacher/homework/attachments/" + copyFile).with(teacher()))
                .hasStatusOk().hasBodyTextEqualTo("%PDF-1.4 test");
    }

    @Test
    void checksTheRoleAndTheAssignment() {
        UUID student = directory.addStudent("Борис");
        assertThat(mvc.post().uri("/api/teacher/homework/assignments/" + UUID.randomUUID() + "/copy")
                .with(teacher())).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("assignment.not-found");
        assertThat(mvc.post().uri("/api/teacher/homework/assignments/" + UUID.randomUUID() + "/copy")
                .with(TestUsers.student(student))).hasStatus(HttpStatus.FORBIDDEN);
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}

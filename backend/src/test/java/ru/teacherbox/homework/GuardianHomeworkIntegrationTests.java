package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.homework.application.AssignmentService;
import ru.teacherbox.homework.application.HomeworkViews.AssignmentDetails;
import ru.teacherbox.homework.application.UploadedFile;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.testing.FakeGuardians;
import ru.teacherbox.testing.FakeTextbooks;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;
import ru.teacherbox.textbooks.api.TextbookFormat;

/** A guardian reads a child's homework as the child does, read-only (ADR-0069). */
@HomeworkIntegrationTest
class GuardianHomeworkIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeGuardians guardians;

    @Autowired
    FakeTextbooks textbooks;

    @Autowired
    AssignmentService assignments;

    @Test
    void aGuardianReadsTheTaskTheAnswerTheReviewAndTheFiles() throws Exception {
        UUID child = directory.addStudent("Маша");
        UUID parent = guardians.addGuardian("Анна", child);
        AssignmentDetails assignment = assignment("Сочинение", child);
        String taskId = assignment.tasks().getFirst().taskId().toString();
        MvcTestResult submitted = mvc.post().uri("/api/me/homework/tasks/" + taskId + "/submissions")
                .with(TestUsers.student(child)).multipart().param("text", "Моё решение")
                .file(new MockMultipartFile("files", "ответ.jpg", "image/jpeg", new byte[] {1, 2, 3})).exchange();
        String answerFile = JsonPath.read(AssignmentIntegrationTests.body(submitted),
                "$.submissions[0].attachments[0].id");
        assertThat(mvc.post().uri("/api/teacher/homework/tasks/" + taskId + "/review").with(teacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"ACCEPT\",\"grade\":\"5\",\"comment\":\"Молодец\"}")).hasStatusOk();
        UUID book = textbooks.add("Spotlight", TextbookFormat.PDF, 120);
        assertThat(mvc.post().uri("/api/teacher/homework/assignments/" + assignment.id() + "/textbooks")
                .with(teacher()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"textbookId\":\"%s\",\"pages\":\"2-3\"}".formatted(book))).hasStatus2xxSuccessful();
        String base = "/api/guardian/students/" + child + "/homework";

        assertThat(as(parent, base + "/summary")).hasStatusOk();
        assertThat(as(parent, base)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$[0].title").isEqualTo("Сочинение");
            assertThat(json).extractingPath("$[0].teacherComment").isEqualTo("Молодец");
        });
        assertThat(as(parent, base + "/tasks/" + taskId)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.status").isEqualTo("ACCEPTED");
            assertThat(json).extractingPath("$.grade").isEqualTo("5");
            assertThat(json).extractingPath("$.submissions[0].text").isEqualTo("Моё решение");
            assertThat(json).extractingPath("$.assignment.attachments[0].filename").isEqualTo("задание.txt");
        });
        MvcTestResult answer = as(parent, base + "/attachments/" + answerFile);
        assertThat(answer).hasStatusOk();
        assertThat(answer.getResponse().getContentAsByteArray()).containsExactly(1, 2, 3);
        MvcTestResult material = as(parent, base + "/attachments/" + assignment.attachments().getFirst().id());
        assertThat(material.getResponse().getContentAsString(StandardCharsets.UTF_8)).isEqualTo("условие");
        assertThat(as(parent, base + "/tasks/" + taskId + "/textbooks/" + book)).hasStatusOk()
                .hasBodyTextEqualTo("Spotlight pages 2-3");
    }

    @Test
    void aGuardianSeesTheQuizButCannotAnswerOrHandIn() {
        UUID child = directory.addStudent("Петя");
        UUID parent = guardians.addGuardian("Олег", child);
        MvcTestResult created = mvc.post().uri("/api/teacher/homework/assignments").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content("""
                        {"title":"Тест","studentIds":["%s"],"quizReveal":"AFTER_SUBMIT","quizAttempts":1,
                         "questions":[{"type":"SHORT_TEXT","text":"Дерево","accepted":["берёза"]}]}
                        """.formatted(child)).exchange();
        String taskId = JsonPath.read(AssignmentIntegrationTests.body(created), "$.tasks[0].taskId");
        String task = "/api/guardian/students/" + child + "/homework/tasks/" + taskId;

        assertThat(as(parent, task + "/quiz")).hasStatusOk().bodyJson().extractingPath("$.questions[0].text")
                .isEqualTo("Дерево");
        assertThat(mvc.post().uri(task + "/quiz/attempts").with(guardian(parent))).hasStatus4xxClientError();
        assertThat(mvc.post().uri(task + "/submissions").with(guardian(parent)).multipart().param("text", "x"))
                .hasStatus4xxClientError();
        assertThat(mvc.post().uri("/api/me/homework/tasks/" + taskId + "/submissions").with(guardian(parent))
                .multipart().param("text", "x")).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/homework/tasks/" + taskId + "/quiz").with(TestUsers.student(child)))
                .hasStatusOk().bodyJson().extractingPath("$.attempts").asArray().isEmpty();
    }

    @Test
    void anotherStudentsHomeworkIsNotFoundAndOtherRolesAreForbidden() {
        UUID child = directory.addStudent("Свой");
        UUID stranger = directory.addStudent("Чужой");
        UUID parent = guardians.addGuardian("Родитель", child);
        AssignmentDetails foreign = assignment("Чужое", stranger);
        String foreignTask = foreign.tasks().getFirst().taskId().toString();
        String base = "/api/guardian/students/" + stranger + "/homework";

        for (String path : new String[] {"", "/summary", "/tasks/" + foreignTask, "/tasks/" + foreignTask + "/quiz",
                "/attachments/" + foreign.attachments().getFirst().id(),
                "/tasks/" + foreignTask + "/textbooks/" + UUID.randomUUID()}) {
            assertThat(as(parent, base + path)).hasStatus(HttpStatus.NOT_FOUND)
                    .bodyJson().extractingPath("$.code").isEqualTo("student.not-found");
        }
        String own = "/api/guardian/students/" + child + "/homework/tasks/" + foreignTask;
        assertThat(as(parent, own)).as("a task of another student under one's own child").hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("task.not-found");
        String summary = "/api/guardian/students/" + child + "/homework/summary";
        assertThat(mvc.get().uri(summary).with(TestUsers.student(child))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(summary).with(teacher())).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/homework").with(guardian(parent))).hasStatus(HttpStatus.FORBIDDEN);

        directory.setStatus(child, StudentStatus.DEACTIVATED);
        assertThat(as(parent, summary)).as("a deactivated child is hidden").hasStatus(HttpStatus.NOT_FOUND);
    }

    private AssignmentDetails assignment(String title, UUID student) {
        AssignmentDetails details = assignments.create(title, "Описание", null, List.of(student));
        assignments.addAttachments(details.id(), List.of(new UploadedFile("задание.txt", 12,
                new ByteArrayResource("условие".getBytes(StandardCharsets.UTF_8)))));
        return assignments.get(details.id());
    }

    private MvcTestResult as(UUID guardian, String uri) {
        return mvc.get().uri(uri).with(guardian(guardian)).exchange();
    }

    private static RequestPostProcessor guardian(UUID guardianId) {
        return TestUsers.guardian(guardianId);
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}

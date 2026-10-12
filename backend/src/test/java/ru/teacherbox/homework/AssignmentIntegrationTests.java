package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.homework.api.AssignmentFiles;
import ru.teacherbox.homework.api.HomeworkAssigned;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.TestUsers;

/** The teacher creates, edits and distributes assignments with materials. */
@HomeworkIntegrationTest
class AssignmentIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    AssignmentFiles files;

    @Test
    void createsAssignmentForStudents(AssertablePublishedEvents events) {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        directory.setAvatar(anna, "/api/public/avatars/anna");

        MvcTestResult result = post("/api/teacher/homework/assignments", """
                {"title":"Дроби","description":"Решить **№1-5**","dueAt":"2030-01-10T15:00:00Z",
                 "studentIds":["%s","%s","%s"]}
                """.formatted(anna, boris, anna));

        assertThat(result).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.title").isEqualTo("Дроби");
            assertThat(json).extractingPath("$.dueAt").isEqualTo("2030-01-10T15:00:00Z");
            assertThat(json).extractingPath("$.tasks[*].studentName").asArray().containsExactly("Анна", "Борис");
            assertThat(json).extractingPath("$.tasks[*].studentAvatar").asArray()
                    .containsExactly("/api/public/avatars/anna", null);
            assertThat(json).extractingPath("$.tasks[*].status").asArray().containsOnly("ASSIGNED");
        });
        String id = JsonPath.read(body(result), "$.id");
        assertThat(events).contains(HomeworkAssigned.class)
                .matching(HomeworkAssigned::studentId, anna)
                .matching(event -> event.assignmentId().toString(), id);

        assertThat(get("/api/teacher/homework/assignments")).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$[?(@.id == '%s')].totalTasks".formatted(id)).asArray()
                    .containsExactly(2);
            assertThat(json).extractingPath("$[?(@.id == '%s')].assigned".formatted(id)).asArray()
                    .containsExactly(2);
        });
    }

    @Test
    void editsWithOptimisticLocking() {
        String id = createdId("Черновик", List.of());

        assertThat(put("/api/teacher/homework/assignments/" + id,
                "{\"title\":\"Итоговое\",\"description\":\"Текст\",\"version\":0}"))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.title").isEqualTo("Итоговое");
                    assertThat(json).extractingPath("$.version").isEqualTo(1);
                });
        assertThat(put("/api/teacher/homework/assignments/" + id, "{\"title\":\"Старое\",\"version\":0}"))
                .hasStatus(HttpStatus.CONFLICT);
    }

    @Test
    void anAssignmentIsWrittenUnlessAnotherKindIsChosen() {
        String id = createdId("Письменное", List.of());

        assertThat(get("/api/teacher/homework/assignments/" + id)).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.kind").isEqualTo("WRITTEN");
            assertThat(json).extractingPath("$.interactiveHtml").isNull();
        });
        assertThat(get("/api/teacher/homework/assignments")).bodyJson()
                .extractingPath("$[?(@.id == '%s')].kind".formatted(id)).asArray().containsExactly("WRITTEN");
    }

    @Test
    void aBoardAssignmentTakesNoMaterials() {
        MvcTestResult created = post("/api/teacher/homework/assignments",
                "{\"kind\":\"BOARD\",\"title\":\"На доске\",\"description\":\"Решить на доске\"}");
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().extractingPath("$.kind").isEqualTo("BOARD");
        String id = JsonPath.read(body(created), "$.id");

        assertThat(upload(id, new MockMultipartFile("files", "a.txt", null, new byte[] {1})))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("assignment.materials-not-allowed");
    }

    @Test
    void anInteractiveAssignmentNeedsHtml() {
        assertThat(post("/api/teacher/homework/assignments", "{\"kind\":\"INTERACTIVE\",\"title\":\"Тест\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("assignment.html-required");
        assertThat(post("/api/teacher/homework/assignments", "{\"kind\":\"QUIZ\",\"title\":\"Тест\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);

        MvcTestResult created = post("/api/teacher/homework/assignments",
                "{\"kind\":\"INTERACTIVE\",\"title\":\"Тест\",\"interactiveHtml\":\"<p>1 + 1 = ?</p>\"}");
        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.kind").isEqualTo("INTERACTIVE");
            assertThat(json).extractingPath("$.interactiveHtml").isEqualTo("<p>1 + 1 = ?</p>");
        });
        String id = JsonPath.read(body(created), "$.id");

        assertThat(put("/api/teacher/homework/assignments/" + id,
                "{\"title\":\"Тест 2\",\"interactiveHtml\":\"<p>2 + 2 = ?</p>\",\"version\":0}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.kind").isEqualTo("INTERACTIVE");
                    assertThat(json).extractingPath("$.interactiveHtml").isEqualTo("<p>2 + 2 = ?</p>");
                });
        assertThat(put("/api/teacher/homework/assignments/" + id, "{\"title\":\"Тест 3\",\"version\":1}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("assignment.html-required");
        assertThat(upload(id, new MockMultipartFile("files", "a.txt", null, new byte[] {1})))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("assignment.materials-not-allowed");
    }

    @Test
    void assignsMoreStudentsWithoutDuplicates() {
        UUID first = directory.addStudent("Первый");
        UUID second = directory.addStudent("Второй");
        String id = createdId("Для группы", List.of(first));

        assertThat(post("/api/teacher/homework/assignments/" + id + "/students",
                "{\"studentIds\":[\"%s\",\"%s\"]}".formatted(first, second)))
                .hasStatusOk()
                .bodyJson().extractingPath("$.tasks.length()").isEqualTo(2);
    }

    @Test
    void rejectsUnknownAndDeactivatedStudents() {
        UUID former = directory.addStudent("Ушёл", StudentStatus.DEACTIVATED);

        assertThat(post("/api/teacher/homework/assignments",
                "{\"title\":\"x\",\"studentIds\":[\"%s\"]}".formatted(UUID.randomUUID())))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("student.not-found");
        assertThat(post("/api/teacher/homework/assignments", "{\"title\":\"x\",\"studentIds\":[\"%s\"]}".formatted(former)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("student.deactivated");
        assertThat(post("/api/teacher/homework/assignments", "{\"title\":\"\"}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(get("/api/teacher/homework/assignments/" + UUID.randomUUID()))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("assignment.not-found");
    }

    @Test
    void managesMaterials() throws Exception {
        String id = createdId("С файлами", List.of());

        MvcTestResult upload = mvc.post().uri("/api/teacher/homework/assignments/" + id + "/attachments")
                .with(teacher())
                .multipart()
                .file(new MockMultipartFile("files", "Задачи.pdf", "application/octet-stream",
                        "%PDF-1.4 test".getBytes(StandardCharsets.UTF_8)))
                .exchange();

        assertThat(upload).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$[0].filename").isEqualTo("Задачи.pdf");
            assertThat(json).extractingPath("$[0].contentType").isEqualTo("application/pdf");
            assertThat(json).extractingPath("$[0].size").isEqualTo(13);
        });
        String attachmentId = JsonPath.read(body(upload), "$[0].id");

        MvcTestResult download = mvc.get().uri("/api/teacher/homework/attachments/" + attachmentId)
                .with(teacher()).exchange();
        assertThat(download).hasStatusOk()
                .hasContentType(MediaType.APPLICATION_PDF)
                .hasHeader("X-Content-Type-Options", "nosniff");
        assertThat(download.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION))
                .startsWith("attachment;").contains("UTF-8''");
        assertThat(download.getResponse().getContentAsString(StandardCharsets.UTF_8)).isEqualTo("%PDF-1.4 test");
        assertThat(get("/api/teacher/homework/assignments/" + id))
                .bodyJson().extractingPath("$.attachments.length()").isEqualTo(1);

        assertThat(mvc.delete().uri("/api/teacher/homework/assignments/" + id + "/attachments/" + attachmentId)
                .with(teacher())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri("/api/teacher/homework/attachments/" + attachmentId).with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.delete().uri("/api/teacher/homework/assignments/" + UUID.randomUUID() + "/attachments/"
                + attachmentId).with(teacher())).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void otherModulesReadTheFilesOfAnAssignment() throws Exception {
        String id = createdId("Для ИИ", List.of());
        String other = createdId("Другое", List.of());
        MvcTestResult uploaded = upload(id, new MockMultipartFile("files", "Задачи.pdf", null,
                "%PDF-1.4 test".getBytes(StandardCharsets.UTF_8)));
        UUID attachment = UUID.fromString(JsonPath.read(body(uploaded), "$[0].id"));

        AssignmentFiles.AssignmentFile file = files.file(UUID.fromString(id), attachment);
        assertThat(file.filename()).isEqualTo("Задачи.pdf");
        assertThat(file.contentType()).isEqualTo("application/pdf");
        assertThat(file.size()).isEqualTo(13);
        assertThat(file.content().getContentAsByteArray()).startsWith("%PDF".getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> files.file(UUID.fromString(other), attachment))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void enforcesFileRules() {
        String id = createdId("Правила файлов", List.of());

        assertThat(upload(id, new MockMultipartFile("files", "virus.exe", null, new byte[] {1})))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("file.type-not-allowed");
        assertThat(upload(id, new MockMultipartFile("files", "big.pdf", null, new byte[2048])))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("file.too-large");
        assertThat(upload(id,
                new MockMultipartFile("files", "a.txt", null, new byte[] {1}),
                new MockMultipartFile("files", "b.txt", null, new byte[] {1}),
                new MockMultipartFile("files", "c.txt", null, new byte[] {1})))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("file.too-many");
    }

    @Test
    void studentsCannotManageAssignments() {
        UUID student = directory.addStudent("Любопытный");

        assertThat(mvc.get().uri("/api/teacher/homework/assignments").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private MvcTestResult upload(String assignmentId, MockMultipartFile... files) {
        var request = mvc.post().uri("/api/teacher/homework/assignments/" + assignmentId + "/attachments")
                .with(teacher())
                .multipart();
        for (MockMultipartFile file : files) {
            request = request.file(file);
        }
        return request.exchange();
    }

    private String createdId(String title, List<UUID> students) {
        String ids = String.join(",", students.stream().map(id -> "\"" + id + "\"").toList());
        MvcTestResult result = post("/api/teacher/homework/assignments",
                "{\"title\":\"%s\",\"studentIds\":[%s]}".formatted(title, ids));
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(body(result), "$.id");
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    private MvcTestResult get(String uri) {
        return mvc.get().uri(uri).with(teacher()).exchange();
    }

    private MvcTestResult post(String uri, String json) {
        return mvc.post().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private MvcTestResult put(String uri, String json) {
        return mvc.put().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    static String body(MvcTestResult result) {
        try {
            return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}

package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.testing.FakeTextbooks;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;
import ru.teacherbox.textbooks.api.TextbookFormat;

/** Textbooks bound to assignments by pages and handed to the students of the assignment (ADR-0033). */
@HomeworkIntegrationTest
class AssignmentTextbooksIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeTextbooks textbooks;

    @Autowired
    MutableClock clock;

    @Test
    void theTeacherBindsTextbooksByPages() {
        UUID student = directory.addStudent("Анна");
        String assignment = createdId(student);
        UUID spotlight = textbooks.add("Spotlight", TextbookFormat.PDF, 120);
        UUID workbook = textbooks.add("Тетрадь", TextbookFormat.DOCUMENT, null);

        assertThat(bind(assignment, "{\"textbookId\":\"%s\",\"pages\":\" 12 – 14, 3\"}".formatted(spotlight)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.textbooks[0].title").isEqualTo("Spotlight");
                    assertThat(json).extractingPath("$.textbooks[0].pages").isEqualTo("3, 12-14");
                    assertThat(json).extractingPath("$.textbooks[0].format").isEqualTo("PDF");
                    assertThat(json).extractingPath("$.textbooks[0].pageCount").isEqualTo(120);
                });
        clock.advance(Duration.ofMinutes(1));
        assertThat(bind(assignment, "{\"textbookId\":\"%s\"}".formatted(workbook))).hasStatusOk().bodyJson()
                .extractingPath("$.textbooks[1].pages").isNull();
        assertThat(bind(assignment, "{\"textbookId\":\"%s\",\"pages\":\"5\"}".formatted(spotlight)))
                .as("the pages change").hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.textbooks[*].pages").asArray().containsExactly("5", null);
                });

        assertThat(bind(assignment, "{\"textbookId\":\"%s\",\"pages\":\"121\"}".formatted(spotlight)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.pages-beyond");
        assertThat(bind(assignment, "{\"textbookId\":\"%s\",\"pages\":\"a-b\"}".formatted(spotlight)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyJson().extractingPath("$.code")
                .isEqualTo("textbooks.pages-invalid");
        assertThat(bind(assignment, "{\"textbookId\":\"%s\"}".formatted(UUID.randomUUID())))
                .hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code")
                .isEqualTo("homework.textbook-not-found");
        assertThat(bind(UUID.randomUUID().toString(), "{\"textbookId\":\"%s\"}".formatted(spotlight)))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(bind(assignment, "{}")).hasStatus(HttpStatus.BAD_REQUEST);

        textbooks.remove(workbook);
        assertThat(mvc.get().uri("/api/teacher/homework/assignments/" + assignment).with(teacher()))
                .as("a deleted textbook disappears").hasStatusOk().bodyJson()
                .extractingPath("$.textbooks[*].title").asArray().containsExactly("Spotlight");

        assertThat(mvc.delete().uri("/api/teacher/homework/assignments/" + assignment + "/textbooks/" + spotlight)
                .with(teacher())).hasStatusOk().bodyJson().extractingPath("$.textbooks").asArray().isEmpty();
        assertThat(mvc.delete().uri("/api/teacher/homework/assignments/" + assignment + "/textbooks/" + spotlight)
                .with(teacher())).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void theStudentGetsOnlyTheBoundPages() {
        UUID student = directory.addStudent("Борис");
        String assignment = createdId(student);
        UUID spotlight = textbooks.add("Spotlight", TextbookFormat.PDF, 120);
        UUID scan = textbooks.add("Scan", TextbookFormat.IMAGE, 1);
        UUID unbound = textbooks.add("Чужой", TextbookFormat.PDF, 10);
        bind(assignment, "{\"textbookId\":\"%s\",\"pages\":\"2-3\"}".formatted(spotlight));
        clock.advance(Duration.ofMinutes(1));
        bind(assignment, "{\"textbookId\":\"%s\",\"pages\":\"1\"}".formatted(scan));
        String taskId = JsonPath.read(AssignmentIntegrationTests.body(
                mvc.get().uri("/api/teacher/homework/assignments/" + assignment).with(teacher()).exchange()),
                "$.tasks[0].taskId");

        assertThat(mvc.get().uri("/api/me/homework/tasks/" + taskId).with(TestUsers.student(student))).hasStatusOk()
                .bodyJson().extractingPath("$.assignment.textbooks[*].pages").asArray().containsExactly("2-3", "1");
        MvcTestResult pages = mvc.get().uri("/api/me/homework/tasks/" + taskId + "/textbooks/" + spotlight)
                .with(TestUsers.student(student)).exchange();
        assertThat(pages).hasStatusOk().hasContentType(MediaType.APPLICATION_PDF)
                .hasHeader("X-Content-Type-Options", "nosniff").hasBodyTextEqualTo("Spotlight pages 2-3");
        assertThat(pages.getResponse().getHeader("Content-Disposition")).startsWith("attachment");
        assertThat(mvc.get().uri("/api/me/homework/tasks/" + taskId + "/textbooks/" + scan)
                .with(TestUsers.student(student))).hasStatusOk().hasBodyTextEqualTo("Scan");
        bind(assignment, "{\"textbookId\":\"%s\",\"pages\":\"\"}".formatted(spotlight));
        assertThat(mvc.get().uri("/api/me/homework/tasks/" + taskId + "/textbooks/" + spotlight)
                .with(TestUsers.student(student))).as("bound whole").hasStatusOk().hasBodyTextEqualTo("Spotlight");

        assertThat(mvc.get().uri("/api/me/homework/tasks/" + taskId + "/textbooks/" + unbound)
                .with(TestUsers.student(student))).as("not bound").hasStatus(HttpStatus.NOT_FOUND);
        UUID stranger = directory.addStudent("Чужой ученик");
        assertThat(mvc.get().uri("/api/me/homework/tasks/" + taskId + "/textbooks/" + spotlight)
                .with(TestUsers.student(stranger))).as("another student").hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/me/homework/tasks/" + taskId + "/textbooks/" + spotlight).with(teacher()))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private String createdId(UUID student) {
        MvcTestResult result = mvc.post().uri("/api/teacher/homework/assignments").with(teacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"С учебником\",\"studentIds\":[\"%s\"]}".formatted(student)).exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(AssignmentIntegrationTests.body(result), "$.id");
    }

    private MvcTestResult bind(String assignment, String json) {
        return mvc.post().uri("/api/teacher/homework/assignments/" + assignment + "/textbooks").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}

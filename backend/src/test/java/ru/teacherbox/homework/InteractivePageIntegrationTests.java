package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.homework.application.AssignmentService;
import ru.teacherbox.homework.application.HomeworkViews.AssignmentDetails;
import ru.teacherbox.homework.domain.AssignmentKind;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The page of interactive homework is served by a short-lived link with its own policy (ADR-0040). */
@HomeworkIntegrationTest
class InteractivePageIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    AssignmentService assignments;

    @Autowired
    MutableClock clock;

    @Test
    void theStudentOpensThePageOfAnOwnTask() {
        UUID student = directory.addStudent("Ученик");
        AssignmentDetails assignment = interactive(student);
        String taskId = assignment.tasks().getFirst().taskId().toString();

        MvcTestResult link = mvc.get().uri("/api/me/homework/tasks/" + taskId + "/interactive-link")
                .with(TestUsers.student(student)).exchange();
        assertThat(link).hasStatusOk().bodyJson().extractingPath("$.expiresAt")
                .isEqualTo(clock.instant().plus(Duration.ofMinutes(5)).toString());
        String url = JsonPath.read(AssignmentIntegrationTests.body(link), "$.url");
        assertThat(url).startsWith("/api/public/homework/interactive/");

        MvcTestResult page = mvc.get().uri(url).exchange();
        assertThat(page).hasStatusOk()
                .hasHeader("Content-Security-Policy",
                        "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; "
                                + "style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; "
                                + "base-uri 'none'; form-action 'none'; frame-ancestors 'self'")
                .hasHeader("X-Frame-Options", "SAMEORIGIN")
                .hasHeader("Cache-Control", "no-store")
                .hasHeader("X-Content-Type-Options", "nosniff");
        assertThat(page.getResponse().getContentType()).startsWith("text/html");
        assertThat(AssignmentIntegrationTests.body(page)).as("the bridge comes before the page's own scripts")
                .startsWith("<script>").contains("teacherbox:result", "teacherbox:height")
                .endsWith("<p>2 + 2 = <input></p>");

        UUID stranger = directory.addStudent("Чужой");
        assertThat(mvc.get().uri("/api/me/homework/tasks/" + taskId + "/interactive-link")
                .with(TestUsers.student(stranger))).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/me/homework/tasks/" + UUID.randomUUID() + "/interactive-link")
                .with(TestUsers.student(student))).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void theTeacherPreviewsThePage() {
        AssignmentDetails assignment = interactive();

        MvcTestResult link = mvc.get().uri("/api/teacher/homework/assignments/" + assignment.id() + "/interactive-link")
                .with(TestUsers.teacher(directory.teacherId())).exchange();
        assertThat(link).hasStatusOk();
        assertThat(mvc.get().uri(JsonPath.<String>read(AssignmentIntegrationTests.body(link), "$.url")))
                .hasStatusOk();

        String written = assignments.create(AssignmentKind.WRITTEN, "Письменное", null, null, null, List.of())
                .id().toString();
        assertThat(mvc.get().uri("/api/teacher/homework/assignments/" + written + "/interactive-link")
                .with(TestUsers.teacher(directory.teacherId()))).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("assignment.not-interactive");
        assertThat(mvc.get().uri("/api/teacher/homework/assignments/" + UUID.randomUUID() + "/interactive-link")
                .with(TestUsers.teacher(directory.teacherId()))).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void aLinkWorksForFiveMinutesAndCannotBeForged() {
        AssignmentDetails assignment = interactive();
        String url = JsonPath.read(AssignmentIntegrationTests.body(mvc.get()
                .uri("/api/teacher/homework/assignments/" + assignment.id() + "/interactive-link")
                .with(TestUsers.teacher(directory.teacherId())).exchange()), "$.url");
        String token = url.substring(url.lastIndexOf('/') + 1);
        String payload = token.substring(0, token.indexOf('.'));
        String signature = token.substring(token.indexOf('.') + 1);

        assertThat(mvc.get().uri(url.replace(signature, flipped(signature)))).as("another signature")
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("homework.page-not-found");
        assertThat(mvc.get().uri(url.replace(payload, flipped(payload)))).as("another assignment")
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/public/homework/interactive/" + payload)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/public/homework/interactive/" + payload + ".***"))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/public/homework/interactive/QUJD." + signature))
                .as("a short payload").hasStatus(HttpStatus.NOT_FOUND);

        clock.advance(Duration.ofMinutes(5));
        assertThat(mvc.get().uri(url)).as("expired").hasStatus(HttpStatus.NOT_FOUND);
    }

    private static String flipped(String part) {
        return (part.charAt(0) == 'A' ? "B" : "A") + part.substring(1);
    }

    private AssignmentDetails interactive(UUID... students) {
        return assignments.create(AssignmentKind.INTERACTIVE, "Тест", null, "<p>2 + 2 = <input></p>", null,
                List.of(students));
    }
}

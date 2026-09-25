package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.homework.api.HomeworkDueSoon;
import ru.teacherbox.homework.api.HomeworkReviewed;
import ru.teacherbox.homework.api.HomeworkSubmitted;
import ru.teacherbox.homework.application.AssignmentService;
import ru.teacherbox.homework.application.DueSoonReminder;
import ru.teacherbox.homework.application.HomeworkViews.AssignmentDetails;
import ru.teacherbox.homework.application.UploadedFile;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;
import org.springframework.core.io.ByteArrayResource;

/** The student hands in tasks, the teacher reviews them. */
@HomeworkIntegrationTest
class SubmissionAndReviewIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    AssignmentService assignments;

    @Autowired
    DueSoonReminder reminder;

    @Autowired
    MutableClock clock;

    @Test
    void studentSeesAndSubmitsOwnTask(AssertablePublishedEvents events) throws Exception {
        UUID student = directory.addStudent("Ученик");
        AssignmentDetails assignment = assignment("Сочинение", student);
        String taskId = assignment.tasks().getFirst().taskId().toString();

        assertThat(mvc.get().uri("/api/me/homework").with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[0].title").isEqualTo("Сочинение");
                    assertThat(json).extractingPath("$[0].status").isEqualTo("ASSIGNED");
                    assertThat(json).extractingPath("$[0].overdue").isEqualTo(false);
                });
        assertThat(mvc.get().uri("/api/me/homework/tasks/" + taskId).with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().extractingPath("$.assignment.attachments[0].filename").isEqualTo("задание.txt");

        MvcTestResult submitted = submit(student, taskId, "Моё решение",
                new MockMultipartFile("files", "ответ.jpg", "image/jpeg", new byte[] {1, 2, 3}));

        assertThat(submitted).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.status").isEqualTo("SUBMITTED");
            assertThat(json).extractingPath("$.submissions[0].text").isEqualTo("Моё решение");
            assertThat(json).extractingPath("$.submissions[0].attachments[0].contentType").isEqualTo("image/jpeg");
        });
        assertThat(events).contains(HomeworkSubmitted.class)
                .matching(HomeworkSubmitted::studentId, student)
                .matching(HomeworkSubmitted::title, "Сочинение");

        String answerFile = JsonPath.read(AssignmentIntegrationTests.body(submitted),
                "$.submissions[0].attachments[0].id");
        String material = assignment.attachments().getFirst().id().toString();
        MvcTestResult ownFile = mvc.get().uri("/api/me/homework/attachments/" + answerFile)
                .with(TestUsers.student(student)).exchange();
        assertThat(ownFile).hasStatusOk();
        assertThat(ownFile.getResponse().getContentAsByteArray()).containsExactly(1, 2, 3);
        MvcTestResult materialFile = mvc.get().uri("/api/me/homework/attachments/" + material)
                .with(TestUsers.student(student)).exchange();
        assertThat(materialFile).hasStatusOk();
        assertThat(materialFile.getResponse().getContentAsString(StandardCharsets.UTF_8)).isEqualTo("условие");
    }

    @Test
    void studentsCannotSeeForeignTasksOrFiles() {
        UUID owner = directory.addStudent("Владелец");
        UUID stranger = directory.addStudent("Чужой");
        AssignmentDetails assignment = assignment("Личное", owner);
        String taskId = assignment.tasks().getFirst().taskId().toString();
        String material = assignment.attachments().getFirst().id().toString();

        assertThat(mvc.get().uri("/api/me/homework/tasks/" + taskId).with(TestUsers.student(stranger)))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("task.not-found");
        assertThat(submit(stranger, taskId, "чужое")).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/me/homework/attachments/" + material).with(TestUsers.student(stranger)))
                .hasStatus(HttpStatus.NOT_FOUND);

        MvcTestResult submitted = submit(owner, taskId, null, new MockMultipartFile("files", "a.txt", null,
                new byte[] {1}));
        String answerFile = JsonPath.read(AssignmentIntegrationTests.body(submitted),
                "$.submissions[0].attachments[0].id");
        assertThat(mvc.get().uri("/api/me/homework/attachments/" + answerFile).with(TestUsers.student(stranger)))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/me/homework").with(TestUsers.teacher(directory.teacherId())))
                .hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson().extractingPath("$.code").isEqualTo("homework.students-only");
    }

    @Test
    void emptySubmissionIsRejected() {
        UUID student = directory.addStudent("Пустой");
        String taskId = assignment("Пусто", student).tasks().getFirst().taskId().toString();

        assertThat(submit(student, taskId, "  "))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("submission.empty");
    }

    @Test
    void teacherReviewsSubmissions(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Проверяемый");
        String taskId = assignment("На проверку", student).tasks().getFirst().taskId().toString();

        assertThat(review(taskId, "ACCEPT", "5")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("task.not-submitted");

        submit(student, taskId, "Первая попытка");
        assertThat(mvc.get().uri("/api/teacher/homework/review-queue").with(teacher()))
                .hasStatusOk()
                .bodyJson().extractingPath("$[?(@.taskId == '%s')].studentName".formatted(taskId)).asArray()
                .containsExactly("Проверяемый");

        assertThat(review(taskId, "RETURN", null)).hasStatusOk()
                .bodyJson().extractingPath("$.status").isEqualTo("RETURNED");
        assertThat(events).contains(HomeworkReviewed.class)
                .matching(HomeworkReviewed::accepted, false);

        clock.advance(Duration.ofMinutes(1));
        submit(student, taskId, "Вторая попытка");
        assertThat(review(taskId, "ACCEPT", "5")).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.status").isEqualTo("ACCEPTED");
            assertThat(json).extractingPath("$.grade").isEqualTo("5");
            assertThat(json).extractingPath("$.teacherComment").isEqualTo("Молодец");
            assertThat(json).extractingPath("$.submissions[*].text").asArray()
                    .containsExactly("Вторая попытка", "Первая попытка");
        });
        assertThat(events).contains(HomeworkReviewed.class)
                .matching(HomeworkReviewed::accepted, true)
                .matching(HomeworkReviewed::grade, "5");

        assertThat(submit(student, taskId, "Третья")).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("task.already-accepted");
        assertThat(mvc.get().uri("/api/teacher/homework/tasks/" + taskId).with(teacher()))
                .hasStatusOk()
                .bodyJson().extractingPath("$.studentName").isEqualTo("Проверяемый");
        assertThat(mvc.get().uri("/api/teacher/homework/tasks/" + UUID.randomUUID()).with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void remindsAboutDeadlinesOnce(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Забывчивый");
        UUID done = directory.addStudent("Успевший");
        Instant soon = clock.instant().plus(Duration.ofHours(5));
        AssignmentDetails due = assignments.create("Скоро срок", null, soon, List.of(student, done));
        assignments.create("Не скоро", null, clock.instant().plus(Duration.ofDays(5)), List.of(student));
        submit(done, due.tasks().get(1).taskId().toString(), "сделано");

        int sent = reminder.sendReminders();

        assertThat(sent).isGreaterThanOrEqualTo(1);
        assertThat(events).contains(HomeworkDueSoon.class)
                .matching(HomeworkDueSoon::studentId, student)
                .matching(HomeworkDueSoon::title, "Скоро срок");
        assertThat(events.ofType(HomeworkDueSoon.class).matching(event -> event.studentId().equals(done))).isEmpty();
        assertThat(reminder.sendReminders()).isZero();

        clock.advance(Duration.ofHours(6));
        assertThat(mvc.get().uri("/api/me/homework").with(TestUsers.student(student)))
                .bodyJson().extractingPath("$[?(@.title == 'Скоро срок')].overdue").asArray().containsExactly(true);
    }

    private AssignmentDetails assignment(String title, UUID student) {
        AssignmentDetails details = assignments.create(title, "Описание", null, List.of(student));
        assignments.addAttachments(details.id(), List.of(new UploadedFile("задание.txt", 12,
                new ByteArrayResource("условие".getBytes(StandardCharsets.UTF_8)))));
        return assignments.get(details.id());
    }

    private MvcTestResult submit(UUID student, String taskId, String text, MockMultipartFile... files) {
        var request = mvc.post().uri("/api/me/homework/tasks/" + taskId + "/submissions")
                .with(TestUsers.student(student))
                .multipart();
        if (text != null) {
            request = request.param("text", text);
        }
        for (MockMultipartFile file : files) {
            request = request.file(file);
        }
        return request.exchange();
    }

    private MvcTestResult review(String taskId, String decision, String grade) {
        String gradeJson = grade == null ? "null" : "\"" + grade + "\"";
        return mvc.post().uri("/api/teacher/homework/tasks/" + taskId + "/review")
                .with(teacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"%s\",\"grade\":%s,\"comment\":\"Молодец\"}".formatted(decision, gradeJson))
                .exchange();
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}

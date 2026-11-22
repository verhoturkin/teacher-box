package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.homework.api.HomeworkJournal;
import ru.teacherbox.homework.api.JournalTask;
import ru.teacherbox.homework.application.AssignmentService;
import ru.teacherbox.homework.application.HomeworkViews.AssignmentDetails;
import ru.teacherbox.homework.application.ReviewService;
import ru.teacherbox.homework.application.ReviewService.Decision;
import ru.teacherbox.homework.application.StudentHomeworkService;
import ru.teacherbox.shared.time.InstanceTimeZone;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The homework part of a student's period report and the homework journal (roadmap 02 stage B, ADR-0072). */
@HomeworkIntegrationTest
class StudentReportIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    AssignmentService assignments;

    @Autowired
    StudentHomeworkService studentHomework;

    @Autowired
    ReviewService reviews;

    @Autowired
    HomeworkJournal journal;

    @Autowired
    InstanceTimeZone timeZone;

    @Autowired
    MutableClock clock;

    @Test
    void tasksGivenOnTheDaysOfThePeriodInTheTeachersTimeZone() {
        UUID anna = directory.addStudent("Анна отчёта");
        ZoneId zone = timeZone.zoneId();
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, zone);
        UUID onTime = given("Вовремя", now.plus(Duration.ofDays(3)), anna);
        assign("Другой", null, directory.addStudent("Не Анна"));
        Instant midnight = today.plusDays(1).atStartOfDay(zone).toInstant();
        clock.advance(Duration.between(now, midnight.minusSeconds(60)));
        // a minute before midnight of the teacher's day
        UUID late = given("С опозданием", clock.instant().minus(Duration.ofHours(1)), anna);
        clock.advance(Duration.ofMinutes(2));
        // a minute after it: the next day
        UUID next = given("Завтрашнее", null, anna);
        studentHomework.submit(anna, onTime, "Готово", List.of());
        reviews.review(onTime, Decision.ACCEPT, "5", "Молодец");
        studentHomework.submit(anna, late, "Готово", List.of());
        reviews.review(late, Decision.RETURN, null, "Ещё раз");

        assertThat(journal.ofStudent(anna, today, today)).extracting(JournalTask::taskId)
                .containsExactly(onTime, late);
        assertThat(journal.ofStudent(anna, today.plusDays(1), today.plusDays(1))).singleElement()
                .satisfies(task -> {
                    assertThat(task.taskId()).isEqualTo(next);
                    assertThat(task.title()).isEqualTo("Завтрашнее");
                    assertThat(task.status()).isEqualTo(JournalTask.Status.ASSIGNED);
                    assertThat(task.handedInOnTime()).isFalse();
                });
        assertThat(report(anna, today, today.plusDays(1))).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.assigned").isEqualTo(3);
            assertThat(json).extractingPath("$.submitted").isEqualTo(2);
            assertThat(json).extractingPath("$.onTime").isEqualTo(1);
            assertThat(json).extractingPath("$.late").isEqualTo(1);
            assertThat(json).extractingPath("$.accepted").isEqualTo(1);
            assertThat(json).extractingPath("$.returned").isEqualTo(1);
            assertThat(json).extractingPath("$.tasks[*].title")
                    .isEqualTo(List.of("Вовремя", "С опозданием", "Завтрашнее"));
            assertThat(json).extractingPath("$.tasks[0].status").isEqualTo("ACCEPTED");
            assertThat(json).extractingPath("$.tasks[0].grade").isEqualTo("5");
            assertThat(json).extractingPath("$.tasks[0].teacherComment").isEqualTo("Молодец");
            assertThat(json).extractingPath("$.tasks[1].status").isEqualTo("RETURNED");
        });
    }

    @Test
    void anUnknownStudentHasAnEmptyReportAndThePeriodIsChecked() {
        LocalDate today = LocalDate.ofInstant(clock.instant(), timeZone.zoneId());
        assertThat(report(UUID.randomUUID(), today, today)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.assigned").isEqualTo(0);
            assertThat(json).extractingPath("$.tasks").asArray().isEmpty();
        });
        assertThat(report(UUID.randomUUID(), today, today.minusDays(1)))
                .hasStatus(HttpStatus.UNPROCESSABLE_ENTITY).bodyJson().extractingPath("$.code")
                .isEqualTo("homework.range-invalid");
        assertThat(mvc.get().uri("/api/teacher/homework/students/" + UUID.randomUUID() + "/report?from=" + today)
                .with(TestUsers.teacher(directory.teacherId())).exchange()).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void theReportIsForTheTeacherOnly() {
        UUID anna = directory.addStudent("Анна ролей");
        String uri = "/api/teacher/homework/students/" + anna + "/report?from=2020-03-01&to=2020-03-31";
        assertThat(mvc.get().uri(uri).with(TestUsers.student(anna)).exchange()).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(uri).with(TestUsers.guardian(UUID.randomUUID())).exchange())
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(uri).with(TestUsers.admin(UUID.randomUUID())).exchange())
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(uri).exchange()).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    private MvcTestResult report(UUID student, LocalDate from, LocalDate to) {
        return mvc.get().uri("/api/teacher/homework/students/" + student + "/report?from=" + from + "&to=" + to)
                .with(TestUsers.teacher(directory.teacherId())).exchange();
    }

    private UUID given(String title, @org.jspecify.annotations.Nullable Instant dueAt, UUID student) {
        return assign(title, dueAt, student).tasks().getFirst().taskId();
    }

    private AssignmentDetails assign(String title, @org.jspecify.annotations.Nullable Instant dueAt,
            UUID... students) {
        return assignments.create(title, null, dueAt, List.of(students));
    }
}

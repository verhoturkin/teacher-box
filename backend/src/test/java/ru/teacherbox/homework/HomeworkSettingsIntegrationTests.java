package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.homework.api.HomeworkDueSoon;
import ru.teacherbox.homework.application.AssignmentService;
import ru.teacherbox.homework.application.DueSoonReminder;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The reminder before the due date, set by the teacher (ADR-0056) and read on every run. */
@HomeworkIntegrationTest
class HomeworkSettingsIntegrationTests {

    private static final String URI = "/api/teacher/homework/settings";

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

    @Autowired
    JdbcClient jdbc;

    @AfterEach
    void defaultWindow() {
        jdbc.sql("delete from homework.settings").update();
    }

    @Test
    void aLongerWindowRemindsEarlierOnTheNextRun(AssertablePublishedEvents events) {
        assertThat(mvc.get().uri(URI).with(teacher())).hasStatusOk()
                .bodyJson().extractingPath("$.dueSoonMinutes").isEqualTo(1440);
        UUID student = directory.addStudent("Заранее");
        assignments.create("Через двое суток", null, clock.instant().plus(Duration.ofHours(47)), List.of(student));

        reminder.sendReminders();
        assertThat(events.ofType(HomeworkDueSoon.class).matching(event -> event.studentId().equals(student))).isEmpty();

        assertThat(change("{\"dueSoonMinutes\":2880}", teacher())).hasStatusOk()
                .bodyJson().extractingPath("$.dueSoonMinutes").isEqualTo(2880);
        reminder.sendReminders();
        assertThat(events).contains(HomeworkDueSoon.class).matching(HomeworkDueSoon::studentId, student);
    }

    @Test
    void theWindowIsOneToSeventyTwoHours() {
        assertThat(change("{\"dueSoonMinutes\":59}", teacher())).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("homework.settings-due-soon-invalid");
        assertThat(change("{\"dueSoonMinutes\":4321}", teacher())).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(change("{}", teacher())).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(change("{\"dueSoonMinutes\":60}", teacher())).hasStatusOk();
        assertThat(change("{\"dueSoonMinutes\":4320}", teacher())).hasStatusOk();
    }

    @Test
    void anUnreadableStoredWindowIsTheDefault() {
        jdbc.sql("insert into homework.settings (id, due_soon_window, updated_at, version)"
                + " values (1, 'soon', current_timestamp, 0)").update();

        assertThat(mvc.get().uri(URI).with(teacher())).hasStatusOk()
                .bodyJson().extractingPath("$.dueSoonMinutes").isEqualTo(1440);
    }

    @Test
    void onlyTheTeacherSeesAndChangesTheWindow() {
        RequestPostProcessor student = TestUsers.student(UUID.randomUUID());
        assertThat(mvc.get().uri(URI).with(student)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(change("{\"dueSoonMinutes\":120}", student)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(change("{\"dueSoonMinutes\":120}", TestUsers.admin(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private MvcTestResult change(String body, RequestPostProcessor user) {
        return mvc.put().uri(URI).with(user).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}

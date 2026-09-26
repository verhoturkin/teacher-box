package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;
import static ru.teacherbox.schedule.LessonsIntegrationTests.lesson;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Calendar subscription links: shown once, readable without signing in, revocable. */
@ScheduleIntegrationTest
class FeedIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @Test
    void aStudentSubscribesToTheirLessons() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Подписчик");
        UUID other = directory.addStudent("Посторонний");
        String kept = plan(student);
        String cancelled = plan(student);
        String foreign = plan(other);
        assertThat(mvc.post().uri("/api/teacher/schedule/lessons/" + cancelled + "/cancel").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content("{}")).hasStatusOk();
        assertThat(mvc.get().uri("/api/me/schedule/feed").with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().extractingPath("$.enabled").isEqualTo(false);

        String path = createFeed(TestUsers.student(student));

        MvcTestResult calendar = mvc.get().uri(path).exchange();
        assertThat(calendar).hasStatusOk();
        assertThat(calendar.getResponse().getContentType()).isEqualTo("text/calendar;charset=UTF-8");
        assertThat(calendar.getResponse().getHeader("Cache-Control")).isEqualTo("no-store");
        String ics = calendar.getResponse().getContentAsString();
        assertThat(ics).contains("UID:" + kept + "@teacherbox", "UID:" + cancelled + "@teacherbox",
                "STATUS:CANCELLED", "SUMMARY:Занятие").doesNotContain(foreign);
        assertThat(mvc.get().uri("/api/me/schedule/feed").with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.enabled").isEqualTo(true);
                    assertThat(json).extractingPath("$.path").isNull();
                });
    }

    @Test
    void aNewLinkReplacesTheOldOneAndCanBeDisabled() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Меняет ссылку");
        String first = createFeed(TestUsers.student(student));
        String second = createFeed(TestUsers.student(student));

        assertThat(mvc.get().uri(first)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri(second)).hasStatusOk();
        assertThat(mvc.delete().uri("/api/me/schedule/feed").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.get().uri(second)).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void theTeacherFeedHasAllLessonsWithNames() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Вера");
        String lessonId = plan(student);

        String ics = mvc.get().uri(createFeed(teacher())).exchange().getResponse().getContentAsString()
                .replace("\r\n ", "");

        assertThat(ics).contains("UID:" + lessonId + "@teacherbox", "SUMMARY:Урок: Вера");
    }

    @Test
    void deactivatedStudentsAndUnknownLinksGetNothing() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Уходит");
        String path = createFeed(TestUsers.student(student));
        directory.setStatus(student, StudentStatus.DEACTIVATED);

        assertThat(mvc.get().uri(path)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/public/schedule/short.ics")).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/public/schedule/" + "a".repeat(43) + ".ics")).hasStatus(HttpStatus.NOT_FOUND);
    }

    private String plan(UUID student) throws UnsupportedEncodingException {
        return id(mvc.post().uri("/api/teacher/schedule/lessons").with(teacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content(lesson(student, Slots.next(clock), 60, true))
                .exchange());
    }

    private String createFeed(RequestPostProcessor user) throws UnsupportedEncodingException {
        MvcTestResult result = mvc.post().uri("/api/me/schedule/feed").with(user).exchange();
        assertThat(result).hasStatusOk();
        String path = JsonPath.read(result.getResponse().getContentAsString(), "$.path");
        assertThat(path).startsWith("/api/public/schedule/").endsWith(".ics");
        return path;
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}

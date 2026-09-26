package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;
import static ru.teacherbox.schedule.LessonsIntegrationTests.lesson;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Home page counters: the teacher's day and a student's nearest lesson. */
@ScheduleIntegrationTest
class SummaryIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @Test
    void theTeacherSeesTodayAndWhatNeedsAttention() throws UnsupportedEncodingException {
        String before = summary();
        UUID student = directory.addStudent("Сводка");
        Instant now = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        String today = id(plan(lesson(student, now, 30, true)));
        plan(lesson(student, Slots.past(clock), 60, true));
        String future = id(plan(lesson(student, now.plus(Duration.ofHours(30)), 60, true)));
        assertThat(mvc.post().uri("/api/me/schedule/lessons/{id}/requests", future).with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content("{\"kind\":\"CANCEL\"}"))
                .hasStatus(HttpStatus.CREATED);

        String after = summary();

        assertThat(count(after, "$.unmarked")).isEqualTo(count(before, "$.unmarked") + 1);
        assertThat(count(after, "$.weekLessons")).isEqualTo(count(before, "$.weekLessons") + 2);
        assertThat(count(after, "$.pendingRequests")).isEqualTo(count(before, "$.pendingRequests") + 1);
        assertThat(JsonPath.<Boolean>read(after, "$.hasLessons")).isTrue();
        assertThat(JsonPath.<List<String>>read(after, "$.today[*].id")).contains(today).doesNotContain(future);
        assertThat(JsonPath.<List<String>>read(after,
                "$.today[?(@.id == '" + today + "')].studentName")).containsExactly("Сводка");
    }

    @Test
    void aStudentSeesTheNearestLesson() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Ближайшее");
        assertThat(mvc.get().uri("/api/me/schedule/summary").with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.next").isNull();
                    assertThat(json).extractingPath("$.weekLessons").isEqualTo(0);
                    assertThat(json).extractingPath("$.pendingRequests").isEqualTo(0);
                });

        Instant soon = clock.instant().truncatedTo(ChronoUnit.SECONDS).plus(Duration.ofHours(5));
        String next = id(plan(lesson(student, soon, 45, true)));
        plan(lesson(student, soon.plus(Duration.ofDays(10)), 45, true));
        plan(lesson(directory.addStudent("Чужой"), soon.minus(Duration.ofHours(1)), 45, true));
        assertThat(mvc.post().uri("/api/me/schedule/lessons/{id}/requests", next).with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content("{\"kind\":\"CANCEL\"}"))
                .hasStatus(HttpStatus.CREATED);

        assertThat(mvc.get().uri("/api/me/schedule/summary").with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.next.id").isEqualTo(next);
                    assertThat(json).extractingPath("$.next.pendingRequest.kind").isEqualTo("CANCEL");
                    assertThat(json).extractingPath("$.weekLessons").isEqualTo(1);
                    assertThat(json).extractingPath("$.pendingRequests").isEqualTo(1);
                });
    }

    @Test
    void summariesRespectRoles() {
        UUID student = directory.addStudent("Не учитель");

        assertThat(mvc.get().uri("/api/teacher/schedule/summary").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/schedule/summary").with(teacher()))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private String summary() throws UnsupportedEncodingException {
        MvcTestResult result = mvc.get().uri("/api/teacher/schedule/summary").with(teacher()).exchange();
        assertThat(result).hasStatusOk();
        return result.getResponse().getContentAsString();
    }

    private static int count(String json, String path) {
        return JsonPath.<Integer>read(json, path);
    }

    private MvcTestResult plan(String body) {
        MvcTestResult result = mvc.post().uri("/api/teacher/schedule/lessons").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return result;
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}

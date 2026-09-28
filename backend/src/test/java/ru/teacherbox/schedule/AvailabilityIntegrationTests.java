package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;
import static ru.teacherbox.schedule.LessonsIntegrationTests.lesson;

import java.io.UnsupportedEncodingException;
import java.time.Duration;
import java.time.Instant;
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

/** A student sees when the teacher is busy (without whose lessons) and cannot ask to move into it. */
@ScheduleIntegrationTest
class AvailabilityIntegrationTests {

    private static final Duration HOUR = Duration.ofHours(1);

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @Test
    void aStudentSeesWhenTheTeacherIsBusyButNotWithWhom() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Смотрит");
        Instant own = Slots.next(clock);
        Instant others = Slots.next(clock);
        plan(student, own);
        plan(directory.addStudent("Чужая Фамилия"), others);

        MvcTestResult busy = mvc.get().uri("/api/me/schedule/busy?from={from}&to={to}", own.minus(HOUR),
                others.plus(HOUR)).with(TestUsers.student(student)).exchange();

        assertThat(busy).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$[?(@.start == '" + others + "')].end").asArray()
                    .containsExactly(others.plus(HOUR).toString());
            assertThat(json).extractingPath("$[?(@.start == '" + own + "')]").asArray().isEmpty();
        });
        assertThat(busy.getResponse().getContentAsString()).doesNotContain("Чужая", "studentId", "topic");
        assertThat(mvc.get().uri("/api/me/schedule/busy?from={from}&to={to}", own, others).with(teacher()))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/schedule/busy?from={from}&to={to}", others, own)
                .with(TestUsers.student(student)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.range-invalid");
        assertThat(mvc.get().uri("/api/me/schedule/busy?from={from}&to={to}", own, own.plus(Duration.ofDays(63)))
                .with(TestUsers.student(student)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
    }

    @Test
    void aMoveIntoABusyTimeIsRefusedAndTheTeacherMayStillApproveOne() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Переносит");
        Instant start = Slots.next(clock);
        String lessonId = plan(student, start);
        Instant taken = Slots.next(clock);
        plan(directory.addStudent("Занят"), taken);

        assertThat(request(student, lessonId, taken.plus(Duration.ofMinutes(30))))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.slot-busy");
        assertThat(request(student, lessonId, start.plus(Duration.ofMinutes(30))))
                .hasStatus(HttpStatus.CREATED);

        String other = plan(student, Slots.next(clock));
        Instant free = Slots.next(clock);
        String requestId = id(request(student, other, free));
        plan(directory.addStudent("Успел раньше"), free);
        assertThat(approve(requestId, "{}"))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.slot-busy");
        assertThat(approve(requestId, "{\"allowBusy\":true}"))
                .hasStatusOk()
                .bodyJson().extractingPath("$.startsAt").isEqualTo(free.toString());
    }

    private String plan(UUID student, Instant start) throws UnsupportedEncodingException {
        return id(mvc.post().uri("/api/teacher/schedule/lessons").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content(lesson(student, start, 60, true)).exchange());
    }

    private MvcTestResult request(UUID student, String lessonId, Instant proposed) {
        return mvc.post().uri("/api/me/schedule/lessons/{id}/requests", lessonId).with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"kind\":\"RESCHEDULE\",\"proposedStartsAt\":\"%s\"}".formatted(proposed))
                .exchange();
    }

    private MvcTestResult approve(String requestId, String body) {
        return mvc.post().uri("/api/teacher/schedule/requests/{id}/approve", requestId).with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}

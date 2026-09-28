package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;
import static ru.teacherbox.schedule.LessonsIntegrationTests.lesson;

import java.io.UnsupportedEncodingException;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
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

/**
 * The teacher marks the time they do not work; a student sees it as busy time and cannot ask to move a
 * lesson into it. Every test removes its off time: the database is shared with the other schedule tests.
 */
@ScheduleIntegrationTest
class OffTimeIntegrationTests {

    private static final ZoneId MOSCOW = ZoneId.of("Europe/Moscow");
    private static final Duration HOUR = Duration.ofHours(1);

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @Test
    void theTeacherKeepsWeeklyOffTime() throws UnsupportedEncodingException {
        // Far ahead, so that no other test meets it.
        LocalDate monday = LocalDate.ofInstant(clock.instant(), MOSCOW).plusYears(5)
                .with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        MvcTestResult created = save(mvc.post().uri("/api/teacher/schedule/off-times"), """
                {"kind":"WEEKLY","weekdays":["WEDNESDAY","MONDAY"],"startTime":"13:00","endTime":"14:00",
                 "startsOn":"%s","note":" Обед "}
                """.formatted(monday));

        assertThat(created).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.kind").isEqualTo("WEEKLY");
            assertThat(json).extractingPath("$.weekdays").asArray().containsExactly("MONDAY", "WEDNESDAY");
            assertThat(json).extractingPath("$.startTime").isEqualTo("13:00:00");
            assertThat(json).extractingPath("$.startsAt").isNull();
            assertThat(json).extractingPath("$.note").isEqualTo("Обед");
        });
        String offTimeId = id(created);
        assertThat(mvc.get().uri("/api/teacher/schedule/off-times").with(teacher())).hasStatusOk()
                .bodyJson().extractingPath("$[?(@.id == '" + offTimeId + "')].note").asArray()
                .containsExactly("Обед");

        Instant from = monday.atStartOfDay(MOSCOW).toInstant();
        assertThat(periods(from, from.plus(Duration.ofDays(7)))).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$[*].start").asArray().containsExactly(
                    monday.atTime(13, 0).atZone(MOSCOW).toInstant().toString(),
                    monday.plusDays(2).atTime(13, 0).atZone(MOSCOW).toInstant().toString());
            assertThat(json).extractingPath("$[0].offTimeId").isEqualTo(offTimeId);
            assertThat(json).extractingPath("$[0].note").isEqualTo("Обед");
        });

        MvcTestResult changed = save(mvc.put().uri("/api/teacher/schedule/off-times/{id}", offTimeId), """
                {"kind":"WEEKLY","weekdays":["FRIDAY"],"startTime":"00:00","endTime":"00:00","startsOn":"%s",
                 "endsOn":"%s"}
                """.formatted(monday, monday.plusDays(4)));
        assertThat(changed).hasStatusOk().bodyJson().extractingPath("$.note").isNull();
        assertThat(periods(from, from.plus(Duration.ofDays(14)))).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$[*].start").asArray()
                    .containsExactly(monday.plusDays(4).atStartOfDay(MOSCOW).toInstant().toString());
            assertThat(json).extractingPath("$[*].end").asArray()
                    .containsExactly(monday.plusDays(5).atStartOfDay(MOSCOW).toInstant().toString());
        });

        assertThat(mvc.delete().uri("/api/teacher/schedule/off-times/{id}", offTimeId).with(teacher()))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.delete().uri("/api/teacher/schedule/off-times/{id}", offTimeId).with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.off-time-not-found");
        assertThat(save(mvc.put().uri("/api/teacher/schedule/off-times/{id}", offTimeId),
                "{\"kind\":\"ONCE\",\"startsAt\":\"%s\",\"endsAt\":\"%s\"}".formatted(from, from.plus(HOUR))))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(periods(from, from.plus(Duration.ofDays(14)))).hasStatusOk().bodyJson().extractingPath("$")
                .asArray().isEmpty();
    }

    @Test
    void aStudentSeesOffTimeAsBusyAndCannotMoveALessonIntoIt() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Хочет в выходной");
        Instant start = Slots.next(clock);
        String lessonId = id(mvc.post().uri("/api/teacher/schedule/lessons").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content(lesson(student, start, 60, true)).exchange());
        Instant off = Slots.next(clock);
        String offTimeId = id(save(mvc.post().uri("/api/teacher/schedule/off-times"),
                "{\"kind\":\"ONCE\",\"startsAt\":\"%s\",\"endsAt\":\"%s\",\"note\":\"Врач\"}"
                        .formatted(off, off.plus(HOUR))));

        MvcTestResult busy = mvc.get().uri("/api/me/schedule/busy?from={from}&to={to}", off, off.plus(HOUR))
                .with(TestUsers.student(student)).exchange();
        assertThat(busy).hasStatusOk().bodyJson().extractingPath("$[*].start").asArray()
                .contains(off.toString());
        assertThat(busy.getResponse().getContentAsString()).doesNotContain("Врач", "offTimeId");
        Instant proposed = off.plus(Duration.ofMinutes(30));
        assertThat(move(student, lessonId, proposed))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.slot-busy");

        assertThat(mvc.delete().uri("/api/teacher/schedule/off-times/{id}", offTimeId).with(teacher()))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(move(student, lessonId, proposed)).hasStatus(HttpStatus.CREATED);
    }

    private MvcTestResult move(UUID student, String lessonId, Instant proposed) {
        return mvc.post().uri("/api/me/schedule/lessons/{id}/requests", lessonId).with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"kind\":\"RESCHEDULE\",\"proposedStartsAt\":\"%s\"}".formatted(proposed))
                .exchange();
    }

    @Test
    void offTimeMustBeComplete() {
        Instant start = Slots.next(clock);

        assertThat(save(mvc.post().uri("/api/teacher/schedule/off-times"),
                "{\"kind\":\"ONCE\",\"startsAt\":\"%s\"}".formatted(start)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.off-time-invalid");
        assertThat(save(mvc.post().uri("/api/teacher/schedule/off-times"),
                "{\"kind\":\"ONCE\",\"startsAt\":\"%s\",\"endsAt\":\"%s\"}".formatted(start, start)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.off-time-invalid");
        assertThat(save(mvc.post().uri("/api/teacher/schedule/off-times"),
                "{\"kind\":\"WEEKLY\",\"startTime\":\"13:00\",\"endTime\":\"14:00\",\"startsOn\":\"2030-01-01\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.weekdays-empty");
        assertThat(save(mvc.post().uri("/api/teacher/schedule/off-times"), "{\"startsAt\":\"%s\"}".formatted(start)))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(periods(start, start)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.range-invalid");
        assertThat(periods(start, start.plus(Duration.ofDays(63)))).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
    }

    @Test
    void onlyTheTeacherManagesOffTime() {
        UUID student = directory.addStudent("Не учитель");

        assertThat(mvc.get().uri("/api/teacher/schedule/off-times").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri("/api/teacher/schedule/off-times").with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON).content("{\"kind\":\"ONCE\"}"))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    private MvcTestResult save(MockMvcTester.MockMvcRequestBuilder request, String body) {
        return request.with(teacher()).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private MvcTestResult periods(Instant from, Instant to) {
        return mvc.get().uri("/api/teacher/schedule/off-times/periods?from={from}&to={to}", from, to)
                .with(teacher()).exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}

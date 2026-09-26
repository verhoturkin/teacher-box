package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.LessonCompleted;
import ru.teacherbox.schedule.api.LessonCompletionRevoked;
import ru.teacherbox.schedule.api.LessonRescheduled;
import ru.teacherbox.schedule.api.LessonScheduled;
import ru.teacherbox.schedule.api.ScheduledLessonCancelled;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Single lessons through the teacher API: planning, moving, cancelling and marking outcomes. */
@ScheduleIntegrationTest
class LessonsIntegrationTests {

    private static final ZoneId MOSCOW = ZoneId.of("Europe/Moscow");

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @Test
    void plansALessonWithDefaultDuration(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Иван");
        Instant start = Slots.next(clock);

        MvcTestResult result = post("/api/teacher/schedule/lessons", """
                {"studentId":"%s","startsAt":"%s","topic":"Дроби","meetingUrl":"https://zoom.us/j/1","allowOverlap":true}
                """.formatted(student, start));

        assertThat(result).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.studentName").isEqualTo("Иван");
            assertThat(json).extractingPath("$.durationMinutes").isEqualTo(60);
            assertThat(json).extractingPath("$.status").isEqualTo("SCHEDULED");
            assertThat(json).extractingPath("$.endsAt").isEqualTo(start.plusSeconds(3600).toString());
        });
        assertThat(events).contains(LessonScheduled.class)
                .matching(LessonScheduled::studentId, student)
                .matching(LessonScheduled::startsAt, start);

        LocalDate day = LocalDate.ofInstant(start, MOSCOW);
        assertThat(mvc.get().uri("/api/teacher/schedule/lessons?from={from}&to={to}", day, day.plusDays(1))
                .with(teacher()))
                .hasStatusOk()
                .bodyJson().extractingPath("$[?(@.studentId == '" + student + "')].topic").asArray()
                .containsExactly("Дроби");
    }

    @Test
    void rejectsOverlapsUnlessAllowed() {
        UUID first = directory.addStudent("Первый");
        UUID second = directory.addStudent("Второй");
        Instant start = Slots.next(clock);
        post("/api/teacher/schedule/lessons", lesson(first, start, 60, true));

        assertThat(post("/api/teacher/schedule/lessons", lesson(second, start.plusSeconds(1800), 60, false)))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.overlap");
        assertThat(post("/api/teacher/schedule/lessons", lesson(second, start.plusSeconds(1800), 60, true)))
                .hasStatus(HttpStatus.CREATED);
    }

    @Test
    void rejectsUnknownAndDeactivatedStudents() {
        UUID gone = directory.addStudent("Ушёл", StudentStatus.DEACTIVATED);

        assertThat(post("/api/teacher/schedule/lessons", lesson(gone, Slots.next(clock), 60, false)))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.student-not-found");
        assertThat(post("/api/teacher/schedule/lessons", lesson(UUID.randomUUID(), Slots.next(clock), 60, false)))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(post("/api/teacher/schedule/lessons", "{\"studentId\":\"%s\"}".formatted(gone)))
                .hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void movesALesson(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Ольга");
        Instant start = Slots.next(clock);
        String id = id(post("/api/teacher/schedule/lessons", lesson(student, start, 60, true)));
        Instant later = Slots.next(clock);

        assertThat(put("/api/teacher/schedule/lessons/" + id, """
                {"startsAt":"%s","durationMinutes":90,"topic":"Степени","allowOverlap":true}
                """.formatted(later)))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.startsAt").isEqualTo(later.toString());
                    assertThat(json).extractingPath("$.originalStartsAt").isEqualTo(start.toString());
                    assertThat(json).extractingPath("$.durationMinutes").isEqualTo(90);
                });
        assertThat(events).contains(LessonRescheduled.class)
                .matching(LessonRescheduled::previousStartsAt, start)
                .matching(LessonRescheduled::startsAt, later)
                .matching(LessonRescheduled::byRequest, false);
    }

    @Test
    void editingOnlyTheTopicIsNotAMove(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Тема");
        Instant start = Slots.next(clock);
        String id = id(post("/api/teacher/schedule/lessons", lesson(student, start, 60, true)));

        assertThat(put("/api/teacher/schedule/lessons/" + id, """
                {"startsAt":"%s","durationMinutes":60,"topic":"Новая тема"}
                """.formatted(start))).hasStatusOk();

        assertThat(events.ofType(LessonRescheduled.class)
                .matching(event -> event.lessonId().toString().equals(id))).isEmpty();
    }

    @Test
    void cancelsByTheTeacherOrOnBehalfOfTheStudent(AssertablePublishedEvents events)
            throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Отменяет");
        String byTeacher = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.next(clock), 60, true)));
        String charged = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.next(clock), 60, true)));

        assertThat(post("/api/teacher/schedule/lessons/" + byTeacher + "/cancel", "{\"reason\":\"Болею\"}"))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.status").isEqualTo("CANCELLED");
                    assertThat(json).extractingPath("$.cancelledBy").isEqualTo("TEACHER");
                });
        assertThat(post("/api/teacher/schedule/lessons/" + charged + "/cancel",
                "{\"reason\":\"Не придёт\",\"byStudent\":true,\"charge\":true}"))
                .hasStatusOk()
                .bodyJson().extractingPath("$.status").isEqualTo("MISSED");
        assertThat(post("/api/teacher/schedule/lessons/" + byTeacher + "/cancel", "{}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.lesson-not-scheduled");
        assertThat(post("/api/teacher/schedule/lessons/" + charged + "/cancel", "{\"charge\":true}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.charge-invalid");

        assertThat(events).contains(ScheduledLessonCancelled.class)
                .matching(event -> event.lessonId().toString(), byTeacher)
                .matching(ScheduledLessonCancelled::cancelledBy, CancelledBy.TEACHER)
                .matching(ScheduledLessonCancelled::charged, false);
        assertThat(events).contains(LessonCompleted.class)
                .matching(event -> event.lessonId().toString(), charged)
                .matching(LessonCompleted::missed, true);
    }

    @Test
    void marksAndCorrectsOutcomes(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Итог");
        Instant past = Slots.past(clock);
        String future = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.next(clock), 60, true)));
        String id = id(post("/api/teacher/schedule/lessons", lesson(student, past, 45, true)));

        assertThat(put("/api/teacher/schedule/lessons/" + future + "/outcome", "{\"outcome\":\"CONDUCTED\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.lesson-not-started");
        assertThat(put("/api/teacher/schedule/lessons/" + id + "/outcome", "{\"outcome\":\"CONDUCTED\"}"))
                .hasStatusOk()
                .bodyJson().extractingPath("$.status").isEqualTo("CONDUCTED");
        assertThat(put("/api/teacher/schedule/lessons/" + id + "/outcome", "{\"outcome\":\"MISSED\"}"))
                .hasStatusOk();
        assertThat(delete("/api/teacher/schedule/lessons/" + id + "/outcome"))
                .hasStatusOk()
                .bodyJson().extractingPath("$.status").isEqualTo("SCHEDULED");

        assertThat(events).contains(LessonCompleted.class)
                .matching(event -> event.lessonId().toString(), id)
                .matching(LessonCompleted::date, LocalDate.ofInstant(past, MOSCOW))
                .matching(LessonCompleted::durationMinutes, 45);
        assertThat(events.ofType(LessonCompleted.class)
                .matching(event -> event.lessonId().toString().equals(id))).hasSize(2);
        assertThat(events.ofType(LessonCompletionRevoked.class)
                .matching(event -> event.lessonId().toString().equals(id))).hasSize(2);
    }

    @Test
    void listsUnmarkedLessons() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Не отмечен");
        String id = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.past(clock), 60, true)));

        assertThat(mvc.get().uri("/api/teacher/schedule/unmarked").with(teacher()))
                .hasStatusOk()
                .bodyJson().extractingPath("$[*].id").asArray().contains(id);
    }

    @Test
    void validatesTheCalendarPeriod() {
        LocalDate today = LocalDate.now(clock);

        assertThat(mvc.get().uri("/api/teacher/schedule/lessons?from={from}&to={to}", today, today).with(teacher()))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.range-invalid");
        assertThat(mvc.get().uri("/api/teacher/schedule/lessons?from={from}&to={to}", today, today.plusDays(401))
                .with(teacher()))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(mvc.get().uri("/api/teacher/schedule/lessons/{id}", UUID.randomUUID()).with(teacher()))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void theTeacherApiIsForTheTeacherOnly() {
        UUID student = directory.addStudent("Любопытный");

        assertThat(mvc.get().uri("/api/teacher/schedule/unmarked").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/schedule/unmarked")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    static String lesson(UUID student, Instant start, int minutes, boolean allowOverlap) {
        return """
                {"studentId":"%s","startsAt":"%s","durationMinutes":%d,"allowOverlap":%s}
                """.formatted(student, start, minutes, allowOverlap);
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    private MvcTestResult post(String uri, String body) {
        return mvc.post().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private MvcTestResult put(String uri, String body) {
        return mvc.put().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private MvcTestResult delete(String uri) {
        return mvc.delete().uri(uri).with(teacher()).exchange();
    }

    static String id(MvcTestResult result) throws UnsupportedEncodingException {
        assertThat(result).hasStatus2xxSuccessful();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.id");
    }
}

package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;
import static ru.teacherbox.schedule.LessonsIntegrationTests.lesson;

import java.io.UnsupportedEncodingException;
import java.time.Duration;
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
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.api.LessonChangeRequested;
import ru.teacherbox.schedule.api.LessonChangeResolved;
import ru.teacherbox.schedule.api.LessonCompleted;
import ru.teacherbox.schedule.api.LessonRescheduled;
import ru.teacherbox.schedule.api.ScheduledLessonCancelled;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** A student asks to move or cancel their lesson; the teacher answers. Students see only their own data. */
@ScheduleIntegrationTest
class RequestsIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @Test
    void studentAsksToMoveAndTheTeacherApproves(AssertablePublishedEvents events)
            throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Маша");
        Instant start = Slots.next(clock);
        String lessonId = planned(student, start);
        Instant proposed = Slots.next(clock);

        MvcTestResult requested = request(student, lessonId, """
                {"kind":"RESCHEDULE","proposedStartsAt":"%s","comment":"Можно позже?"}
                """.formatted(proposed));
        assertThat(requested).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.status").isEqualTo("PENDING");
            assertThat(json).extractingPath("$.late").isEqualTo(false);
        });
        String requestId = id(requested);
        assertThat(events).contains(LessonChangeRequested.class)
                .matching(LessonChangeRequested::kind, ChangeKind.RESCHEDULE)
                .matching(LessonChangeRequested::proposedStartsAt, proposed);

        assertThat(mvc.get().uri("/api/teacher/schedule/requests").with(teacher()))
                .hasStatusOk()
                .bodyJson().extractingPath("$[?(@.id == '" + requestId + "')].studentName").asArray()
                .containsExactly("Маша");
        assertThat(teacherPost("/api/teacher/schedule/requests/" + requestId + "/approve", "{\"answer\":\"Ок\"}"))
                .hasStatusOk()
                .bodyJson().extractingPath("$.startsAt").isEqualTo(proposed.toString());

        assertThat(events).contains(LessonRescheduled.class)
                .matching(LessonRescheduled::byRequest, true)
                .matching(LessonRescheduled::startsAt, proposed);
        assertThat(events).contains(LessonChangeResolved.class)
                .matching(LessonChangeResolved::approved, true)
                .matching(LessonChangeResolved::comment, "Ок");
        assertThat(mvc.get().uri("/api/me/schedule/requests").with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().extractingPath("$[0].status").isEqualTo("APPROVED");
        assertThat(teacherPost("/api/teacher/schedule/requests/" + requestId + "/decline", "{}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.request-resolved");
    }

    @Test
    void theTeacherMayChooseAnotherTime() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Коля");
        String lessonId = planned(student, Slots.next(clock));
        String requestId = id(request(student, lessonId, """
                {"kind":"RESCHEDULE","proposedStartsAt":"%s"}
                """.formatted(Slots.next(clock))));
        Instant chosen = Slots.next(clock);

        assertThat(teacherPost("/api/teacher/schedule/requests/" + requestId + "/approve",
                "{\"startsAt\":\"%s\"}".formatted(chosen)))
                .hasStatusOk()
                .bodyJson().extractingPath("$.startsAt").isEqualTo(chosen.toString());
    }

    @Test
    void lateCancellationMayBeCharged(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Поздно");
        Instant soon = clock.instant().plus(Duration.ofHours(3));
        String lessonId = id(teacherPost("/api/teacher/schedule/lessons", lesson(student, soon, 60, true)));

        MvcTestResult requested = request(student, lessonId, "{\"kind\":\"CANCEL\",\"comment\":\"Заболел\"}");
        assertThat(requested).hasStatus(HttpStatus.CREATED).bodyJson().extractingPath("$.late").isEqualTo(true);
        assertThat(events).contains(LessonChangeRequested.class).matching(LessonChangeRequested::late, true);

        assertThat(teacherPost("/api/teacher/schedule/requests/" + id(requested) + "/approve", "{\"charge\":true}"))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.status").isEqualTo("MISSED");
                    assertThat(json).extractingPath("$.cancelledBy").isEqualTo("STUDENT");
                    assertThat(json).extractingPath("$.cancelReason").isEqualTo("Заболел");
                });
        assertThat(events).contains(LessonCompleted.class)
                .matching(event -> event.lessonId().toString(), lessonId)
                .matching(LessonCompleted::missed, true)
                .matching(LessonCompleted::date, LocalDate.ofInstant(soon, ZoneId.of("Europe/Moscow")));
        assertThat(events).contains(ScheduledLessonCancelled.class)
                .matching(event -> event.lessonId().toString(), lessonId)
                .matching(ScheduledLessonCancelled::byRequest, true)
                .matching(ScheduledLessonCancelled::charged, true);
        assertThat(events).contains(LessonChangeResolved.class).matching(LessonChangeResolved::charged, true);
    }

    @Test
    void earlyCancellationIsFreeAndMovesCannotBeCharged(AssertablePublishedEvents events)
            throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Заранее");
        String cancelled = planned(student, Slots.next(clock));
        String moved = planned(student, Slots.next(clock));
        String cancelRequest = id(request(student, cancelled, "{\"kind\":\"CANCEL\"}"));
        String moveRequest = id(request(student, moved, """
                {"kind":"RESCHEDULE","proposedStartsAt":"%s"}
                """.formatted(Slots.next(clock))));

        assertThat(teacherPost("/api/teacher/schedule/requests/" + cancelRequest + "/approve", "{}"))
                .hasStatusOk()
                .bodyJson().extractingPath("$.status").isEqualTo("CANCELLED");
        assertThat(teacherPost("/api/teacher/schedule/requests/" + moveRequest + "/approve", "{\"charge\":true}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.charge-invalid");
        assertThat(events).contains(ScheduledLessonCancelled.class)
                .matching(event -> event.lessonId().toString(), cancelled)
                .matching(ScheduledLessonCancelled::charged, false);
    }

    @Test
    void theTeacherDeclines(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Отказ");
        String lessonId = planned(student, Slots.next(clock));
        String requestId = id(request(student, lessonId, "{\"kind\":\"CANCEL\"}"));

        assertThat(teacherPost("/api/teacher/schedule/requests/" + requestId + "/decline",
                "{\"answer\":\"Давайте проведём\"}"))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.status").isEqualTo("DECLINED");
                    assertThat(json).extractingPath("$.answer").isEqualTo("Давайте проведём");
                });
        assertThat(events).contains(LessonChangeResolved.class)
                .matching(LessonChangeResolved::approved, false)
                .matching(event -> event.lessonId().toString(), lessonId);
    }

    @Test
    void oneRequestAtATimeAndTheStudentMayWithdrawIt() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Передумал");
        String lessonId = planned(student, Slots.next(clock));
        String requestId = id(request(student, lessonId, "{\"kind\":\"CANCEL\"}"));

        assertThat(request(student, lessonId, "{\"kind\":\"CANCEL\"}"))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.request-pending");
        assertThat(mvc.get().uri("/api/me/schedule/lessons/" + lessonId).with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().extractingPath("$.pendingRequest.id").isEqualTo(requestId);
        assertThat(mvc.delete().uri("/api/me/schedule/requests/" + requestId).with(TestUsers.student(student)))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(request(student, lessonId, "{\"kind\":\"CANCEL\"}")).hasStatus(HttpStatus.CREATED);
    }

    @Test
    void theTeacherChangingTheLessonOutdatesTheRequest() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Устарел");
        String lessonId = planned(student, Slots.next(clock));
        String requestId = id(request(student, lessonId, "{\"kind\":\"CANCEL\"}"));

        assertThat(teacherPost("/api/teacher/schedule/lessons/" + lessonId + "/cancel", "{}")).hasStatusOk();

        assertThat(mvc.get().uri("/api/me/schedule/requests").with(TestUsers.student(student)))
                .hasStatusOk()
                .bodyJson().extractingPath("$[?(@.id == '" + requestId + "')].status").asArray()
                .containsExactly("OUTDATED");
    }

    @Test
    void studentsSeeOnlyTheirOwnLessons() throws UnsupportedEncodingException {
        UUID owner = directory.addStudent("Хозяин");
        UUID stranger = directory.addStudent("Чужой");
        Instant start = Slots.next(clock);
        String lessonId = planned(owner, start);
        LocalDate day = LocalDate.ofInstant(start, ZoneId.of("Europe/Moscow"));

        assertThat(mvc.get().uri("/api/me/schedule/lessons?from={from}&to={to}", day, day.plusDays(1))
                .with(TestUsers.student(owner)))
                .hasStatusOk()
                .bodyJson().extractingPath("$[*].id").asArray().containsExactly(lessonId);
        assertThat(mvc.get().uri("/api/me/schedule/lessons?from={from}&to={to}", day, day.plusDays(1))
                .with(TestUsers.student(stranger)))
                .hasStatusOk()
                .bodyJson().extractingPath("$").asArray().isEmpty();
        assertThat(mvc.get().uri("/api/me/schedule/lessons/" + lessonId).with(TestUsers.student(stranger)))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(request(stranger, lessonId, "{\"kind\":\"CANCEL\"}")).hasStatus(HttpStatus.NOT_FOUND);

        String requestId = id(request(owner, lessonId, "{\"kind\":\"CANCEL\"}"));
        assertThat(mvc.delete().uri("/api/me/schedule/requests/" + requestId).with(TestUsers.student(stranger)))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/me/schedule/requests").with(TestUsers.student(stranger)))
                .hasStatusOk()
                .bodyJson().extractingPath("$").asArray().isEmpty();
    }

    @Test
    void theTeacherHasNoStudentSchedule() {
        assertThat(mvc.get().uri("/api/me/schedule/requests").with(teacher()))
                .hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.students-only");
        assertThat(mvc.get().uri("/api/me/schedule/settings").with(teacher()))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.timeZone").isEqualTo("Europe/Moscow");
                    assertThat(json).extractingPath("$.lateCancellationMinutes").isEqualTo(1440);
                    assertThat(json).extractingPath("$.reminderMinutes").asArray().containsExactly(60, 1440);
                    assertThat(json).extractingPath("$.defaultDurationMinutes").isEqualTo(60);
                });
    }

    @Test
    void validatesTheRequest() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Спрашивает");
        String lessonId = planned(student, Slots.next(clock));

        assertThat(request(student, lessonId, "{\"kind\":\"RESCHEDULE\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.proposed-time-invalid");
        assertThat(request(student, lessonId, "{}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(teacherPost("/api/teacher/schedule/requests/" + UUID.randomUUID() + "/approve", "{}"))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    private String planned(UUID student, Instant start) throws UnsupportedEncodingException {
        return id(teacherPost("/api/teacher/schedule/lessons", lesson(student, start, 60, true)));
    }

    private MvcTestResult request(UUID student, String lessonId, String body) {
        return mvc.post().uri("/api/me/schedule/lessons/" + lessonId + "/requests")
                .with(TestUsers.student(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    private MvcTestResult teacherPost(String uri, String body) {
        return mvc.post().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }
}

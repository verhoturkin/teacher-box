package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;
import static ru.teacherbox.schedule.LessonsIntegrationTests.lesson;

import java.io.UnsupportedEncodingException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.JournalLesson;
import ru.teacherbox.schedule.api.LessonJournal;
import ru.teacherbox.schedule.api.LessonOutcome;
import ru.teacherbox.testing.FakeAssignments;
import ru.teacherbox.testing.FakeLessonPlans;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The schedule part of a student's period report and the lesson journal (roadmap 02 stage B, ADR-0072). */
@ScheduleIntegrationTest
class StudentReportIntegrationTests extends ScheduleHttpTestSupport {

    private static final String LESSONS = "/api/teacher/schedule/lessons";
    private static final String MARCH = "?from=2020-03-01&to=2020-03-31";

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    FakeLessonPlans plans;

    @Autowired
    FakeAssignments assignments;

    @Autowired
    LessonJournal journal;

    @Autowired
    MutableClock clock;

    @Test
    void countsTheOutcomesOfTheDaysOfThePeriodInTheTeachersTimeZone() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID group = groups.addGroup("ОГЭ", anna, boris);
        // 23:30 on 29 February in Moscow: the day before the period
        cancel(single(anna, "2020-02-29T20:30:00Z"), false);
        // 00:30 on 1 March in Moscow, 29 February in UTC: the first day
        String first = id(post(LESSONS, """
                {"studentId":"%s","startsAt":"2020-02-29T21:30:00Z","topic":"Past Simple","allowOverlap":true}
                """.formatted(anna)));
        put(LESSONS + "/" + first + "/outcome", "{\"outcome\":\"CONDUCTED\"}");
        put(LESSONS + "/" + first + "/summary", "{\"summary\":\"Правильные глаголы\"}");
        UUID plan = plans.add("Past Simple", List.of(), List.of());
        put(LESSONS + "/" + first + "/plan", "{\"planId\":\"" + plan + "\"}");
        UUID assignment = assignments.add("Упражнения");
        post(LESSONS + "/" + first + "/homework", "{\"assignmentId\":\"" + assignment + "\"}");
        String byStudent = single(anna, "2020-03-10T10:00:00Z");
        cancel(byStudent, true);
        String late = single(anna, "2020-03-12T10:00:00Z");
        post(LESSONS + "/" + late + "/cancel", "{\"byStudent\":true,\"charge\":true}");
        String missed = single(anna, "2020-03-15T10:00:00Z");
        put(LESSONS + "/" + missed + "/outcome", "{\"outcome\":\"MISSED\"}");
        // 23:30 on 31 March in Moscow: the last day; Anna told in time she would not come
        String together = id(post(LESSONS, """
                {"groupId":"%s","startsAt":"2020-03-31T20:30:00Z","durationMinutes":90,"allowOverlap":true}
                """.formatted(group)));
        put(LESSONS + "/" + together + "/attendance", "{\"marks\":{\"" + anna + "\":\"EXCUSED\",\"" + boris
                + "\":\"ATTENDED\"}}");
        // 00:30 on 1 April in Moscow, still 31 March in UTC: after the period
        cancel(single(anna, "2020-03-31T21:30:00Z"), false);

        assertThat(get("/api/teacher/schedule/students/" + anna + "/report" + MARCH)).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.held").isEqualTo(1);
                    assertThat(json).extractingPath("$.missed").isEqualTo(1);
                    assertThat(json).extractingPath("$.excused").isEqualTo(1);
                    assertThat(json).extractingPath("$.cancelledByStudent").isEqualTo(1);
                    assertThat(json).extractingPath("$.lateCancellations").isEqualTo(1);
                    assertThat(json).extractingPath("$.lessons[*].lessonId")
                            .isEqualTo(List.of(first, byStudent, late, missed, together));
                    assertThat(json).extractingPath("$.lessons[*].outcome").isEqualTo(List.of("ATTENDED",
                            "CANCELLED", "LATE_CANCELLED", "MISSED", "EXCUSED"));
                    assertThat(json).extractingPath("$.lessons[0].topic").isEqualTo("Past Simple");
                    assertThat(json).extractingPath("$.lessons[0].summary").isEqualTo("Правильные глаголы");
                    assertThat(json).extractingPath("$.lessons[0].planId").isEqualTo(plan.toString());
                    assertThat(json).extractingPath("$.lessons[0].assignmentIds")
                            .isEqualTo(List.of(assignment.toString()));
                    assertThat(json).extractingPath("$.lessons[0].cancelledBy").isNull();
                    assertThat(json).extractingPath("$.lessons[1].cancelledBy").isEqualTo("STUDENT");
                    assertThat(json).extractingPath("$.lessons[2].cancelledBy").isEqualTo("STUDENT");
                    assertThat(json).extractingPath("$.lessons[4].groupId").isEqualTo(group.toString());
                    assertThat(json).extractingPath("$.lessons[4].durationMinutes").isEqualTo(90);
                });
        // a group lesson counts for each participant with their own attendance
        assertThat(get("/api/teacher/schedule/students/" + boris + "/report" + MARCH)).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.held").isEqualTo(1);
                    assertThat(json).extractingPath("$.lessons[*].lessonId").isEqualTo(List.of(together));
                });
        assertThat(journal.ofStudent(anna, LocalDate.parse("2020-03-31"), LocalDate.parse("2020-03-31")))
                .extracting(JournalLesson::lessonId).containsExactly(UUID.fromString(together));
    }

    @Test
    void aLessonAheadIsPlannedAndOneCancelledByTheTeacherNamesThem() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        Instant ahead = Slots.next(clock);
        String planned = id(post(LESSONS, lesson(anna, ahead, 60, true)));
        String cancelled = id(post(LESSONS, lesson(anna, Slots.next(clock), 60, true)));
        cancel(cancelled, false);
        LocalDate day = LocalDate.ofInstant(ahead, ZoneId.of("Europe/Moscow"));

        assertThat(journal.ofStudent(anna, day, day.plusDays(30))).satisfiesExactly(
                lesson -> {
                    assertThat(lesson.lessonId()).isEqualTo(UUID.fromString(planned));
                    assertThat(lesson.outcome()).isEqualTo(LessonOutcome.PLANNED);
                },
                lesson -> {
                    assertThat(lesson.outcome()).isEqualTo(LessonOutcome.CANCELLED);
                    assertThat(lesson.cancelledBy()).isEqualTo(CancelledBy.TEACHER);
                });
    }

    @Test
    void anUnknownStudentHasAnEmptyReportAndThePeriodIsChecked() {
        assertThat(get("/api/teacher/schedule/students/" + UUID.randomUUID() + "/report" + MARCH)).hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.held").isEqualTo(0);
                    assertThat(json).extractingPath("$.lessons").asArray().isEmpty();
                });
        String uri = "/api/teacher/schedule/students/" + UUID.randomUUID() + "/report";
        assertThat(get(uri + "?from=2020-03-31&to=2020-03-01")).hasStatus(HttpStatus.UNPROCESSABLE_ENTITY)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.range-invalid");
        assertThat(get(uri + "?from=2020-01-01&to=2021-12-31")).hasStatus(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(get(uri + "?from=2020-03-01")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void theReportIsForTheTeacherOnly() {
        UUID anna = directory.addStudent("Анна");
        String uri = "/api/teacher/schedule/students/" + anna + "/report" + MARCH;
        assertThat(mvc.get().uri(uri).with(TestUsers.student(anna)).exchange()).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(uri).with(TestUsers.guardian(UUID.randomUUID())).exchange())
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(uri).with(TestUsers.admin(UUID.randomUUID())).exchange())
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(uri).exchange()).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    private String single(UUID student, String startsAt) throws UnsupportedEncodingException {
        return id(post(LESSONS, lesson(student, Instant.parse(startsAt), 60, true)));
    }

    private void cancel(String lessonId, boolean byStudent) {
        assertThat(post(LESSONS + "/" + lessonId + "/cancel", "{\"byStudent\":" + byStudent + "}"))
                .hasStatus2xxSuccessful();
    }
}

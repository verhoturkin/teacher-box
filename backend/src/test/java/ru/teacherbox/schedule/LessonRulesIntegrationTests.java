package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import ru.teacherbox.schedule.application.ScheduleService;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The teacher's lesson rules (ADR-0056): changed in the portal, in force at once. */
@ScheduleIntegrationTest
class LessonRulesIntegrationTests extends ScheduleHttpTestSupport {

    private static final String URI = "/api/teacher/schedule/settings";

    @Autowired
    TestLessonRules testRules;

    @Autowired
    ScheduleService schedule;

    @Autowired
    MutableClock clock;

    @AfterEach
    void backToTheTestRules() {
        testRules.restore();
    }

    @Test
    void theTeacherReadsAndChangesTheRulesAndTheyAreInForceAtOnce() throws UnsupportedEncodingException {
        assertThat(get(URI)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.defaultDurationMinutes").isEqualTo(60);
            assertThat(json).extractingPath("$.lateCancellationMinutes").isEqualTo(1440);
            assertThat(json).extractingPath("$.reminderMinutes").isEqualTo(List.of(60, 1440));
            assertThat(json).extractingPath("$.horizonWeeks").isEqualTo(4);
        });

        assertThat(put(URI, rules(90, 720, "[2880, 30, 30]", 8))).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.defaultDurationMinutes").isEqualTo(90);
            assertThat(json).extractingPath("$.reminderMinutes").isEqualTo(List.of(30, 2880));
            assertThat(json).extractingPath("$.horizonWeeks").isEqualTo(8);
        });

        UUID student = directory.addStudent("Правила");
        assertThat(mvc.get().uri("/api/me/schedule/settings").with(TestUsers.student(student)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.defaultDurationMinutes").isEqualTo(90);
                    assertThat(json).extractingPath("$.lateCancellationMinutes").isEqualTo(720);
                    assertThat(json).extractingPath("$.reminderMinutes").isEqualTo(List.of(30, 2880));
                });
        assertThat(post("/api/teacher/schedule/lessons", """
                {"studentId":"%s","startsAt":"%s","allowOverlap":true}
                """.formatted(student, Slots.next(clock)))).hasStatus(HttpStatus.CREATED)
                .bodyJson().extractingPath("$.durationMinutes").isEqualTo(90);

        assertThat(put(URI, rules(60, 0, "[]", 4))).hasStatusOk()
                .bodyJson().extractingPath("$.reminderMinutes").isEqualTo(List.of());
    }

    @Test
    void aLongerHorizonFillsSeriesUpOnTheNextRunAndAShorterOneRemovesNothing()
            throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Серия вперёд");
        Instant start = Slots.next(clock);
        String body = post("/api/teacher/schedule/lessons", """
                {"studentId":"%s","startsAt":"%s","repeatWeeks":1,"allowOverlap":true}
                """.formatted(student, start)).getResponse().getContentAsString();
        String lessonId = JsonPath.read(body, "$.id");
        int fourWeeks = lessonsOfSeries(lessonId);

        assertThat(put(URI, rules(60, 1440, "[60, 1440]", 8))).hasStatusOk();
        schedule.generateOccurrences();
        int eightWeeks = lessonsOfSeries(lessonId);
        assertThat(eightWeeks).isGreaterThanOrEqualTo(fourWeeks + 4);

        assertThat(put(URI, rules(60, 1440, "[60, 1440]", 4))).hasStatusOk();
        schedule.generateOccurrences();
        assertThat(lessonsOfSeries(lessonId)).isEqualTo(eightWeeks);
    }

    @Test
    void valuesOutsideTheLimitsAreRefused() {
        assertRefused(rules(14, 0, "[]", 4), "schedule.settings-duration-invalid");
        assertRefused(rules(481, 0, "[]", 4), "schedule.settings-duration-invalid");
        assertRefused(rules(60, -1, "[]", 4), "schedule.settings-late-cancellation-invalid");
        assertRefused(rules(60, 10081, "[]", 4), "schedule.settings-late-cancellation-invalid");
        assertRefused(rules(60, 0, "[15, 60, 120, 1440]", 4), "schedule.settings-reminders-invalid");
        assertRefused(rules(60, 0, "[14]", 4), "schedule.settings-reminders-invalid");
        assertRefused(rules(60, 0, "[10081]", 4), "schedule.settings-reminders-invalid");
        assertRefused(rules(60, 0, "[]", 3), "schedule.settings-horizon-invalid");
        assertRefused(rules(60, 0, "[]", 27), "schedule.settings-horizon-invalid");
        assertThat(put(URI, "{\"defaultDurationMinutes\":60}")).hasStatus(HttpStatus.BAD_REQUEST);

        assertThat(put(URI, rules(15, 10080, "[15, 60, 10080]", 26))).hasStatusOk();
        assertThat(put(URI, rules(480, 0, "[]", 4))).hasStatusOk();
    }

    @Test
    void anImportedValueKeepsTheOldLimitsAndAnUnreadableOneIsTheDefault() {
        jdbc.sql("update schedule.settings set default_duration = 5, horizon = 'PT240H', reminders = 'later'"
                + " where id = 1").update();

        assertThat(get(URI)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.defaultDurationMinutes").isEqualTo(5);
            assertThat(json).extractingPath("$.horizonWeeks").isEqualTo(2);
            assertThat(json).extractingPath("$.reminderMinutes").isEqualTo(List.of(60, 1440));
        });
    }

    @Test
    void onlyTheTeacherSeesAndChangesTheRules() {
        String valid = rules(60, 0, "[]", 4);
        UUID student = directory.addStudent("Чужие правила");

        assertThat(mvc.get().uri(URI).with(TestUsers.student(student))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.put().uri(URI).with(TestUsers.student(student)).contentType(MediaType.APPLICATION_JSON)
                .content(valid)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.put().uri(URI).with(TestUsers.admin(UUID.randomUUID())).contentType(MediaType.APPLICATION_JSON)
                .content(valid)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(URI)).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    private void assertRefused(String body, String code) {
        assertThat(put(URI, body)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo(code);
    }

    private int lessonsOfSeries(String lessonId) {
        return jdbc.sql("select count(*) from schedule.lessons where series_id ="
                        + " (select series_id from schedule.lessons where id = :id)")
                .param("id", UUID.fromString(lessonId))
                .query(Integer.class)
                .single();
    }

    private static String rules(int duration, int late, String reminders, int horizonWeeks) {
        return """
                {"defaultDurationMinutes":%d,"lateCancellationMinutes":%d,"reminderMinutes":%s,"horizonWeeks":%d}
                """.formatted(duration, late, reminders, horizonWeeks);
    }
}

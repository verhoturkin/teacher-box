package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.schedule.application.ScheduleService;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

@ScheduleIntegrationTest
@TestPropertySource(properties = "teacherbox.schedule.horizon=84d")
class LessonRepeatsIntegrationTests {
    @Autowired MockMvcTester mvc;
    @Autowired FakeUserDirectory directory;
    @Autowired MutableClock clock;
    @Autowired JdbcClient jdbc;
    @Autowired ScheduleService schedule;

    @Test
    void convertsAnExistingLessonToEverySupportedIntervalWithoutChangingItsIdentity() throws Exception {
        for (int weeks = 1; weeks <= 4; weeks++) {
            UUID student = directory.addStudent("Повтор " + weeks);
            Instant start = clock.instant().plusSeconds(86400L * 2);
            String id = id(post("/lessons", input(student, start, 0)));
            MvcTestResult changed = put(id, edit(start, weeks, "ONLY", "Тема"));
            assertThat(changed).hasStatusOk().bodyJson().satisfies(json -> {
                assertThat(json).extractingPath("$.id").isEqualTo(id);
                assertThat(json).extractingPath("$.seriesId").isNotNull();
            });
            assertThat(JsonPath.<Integer>read(body(changed), "$.repeatWeeks")).isEqualTo(weeks);
            String occurrence = JsonPath.read(body(changed), "$.occurrenceDate");
            Instant moved = start.plusSeconds(86400L * 35);
            assertThat(put(id, edit(moved, weeks, "ONLY", "Исключение"))).hasStatusOk().bodyJson()
                    .extractingPath("$.occurrenceDate").isEqualTo(occurrence);
            assertThat(mvc.get().uri("/api/teacher/schedule/lessons/" + id + "/following")
                    .with(TestUsers.student(student))).hasStatus(HttpStatus.FORBIDDEN);
        }
    }

    @Test
    void followingScopePreservesAnIndividuallyEditedOccurrenceAndOnceKeepsTheSelectedLesson() throws Exception {
        UUID student = directory.addStudent("Исключения");
        Instant start = clock.instant().plusSeconds(86400L * 2);
        String root = id(post("/lessons", input(student, start, 1)));
        List<Map<String, Object>> before = list(student, start);
        String protectedId = before.get(1).get("id").toString();
        Instant protectedStart = Instant.parse(before.get(1).get("startsAt").toString());
        assertThat(put(protectedId, edit(protectedStart, 1, "ONLY", "Индивидуальная тема"))).hasStatusOk();
        MvcTestResult preview = mvc.get().uri("/api/teacher/schedule/lessons/" + root + "/following")
                .with(TestUsers.teacher(directory.teacherId())).exchange();
        assertThat(preview).hasStatusOk().bodyJson().extractingPath("$.protectedLessons").asArray().contains(protectedId);
        assertThat(put(root, edit(start, 0, "FOLLOWING", "Один раз"))).hasStatusOk().bodyJson()
                .extractingPath("$.id").isEqualTo(root);
        assertThat(list(student, start)).extracting(row -> row.get("id")).containsExactly(root, protectedId);
        assertThat(mvc.get().uri("/api/teacher/schedule/lessons/" + protectedId)
                .with(TestUsers.teacher(directory.teacherId()))).hasStatusOk().bodyJson()
                .extractingPath("$.title").isEqualTo("Индивидуальная тема");
    }

    @Test
    void aDeletedOccurrenceDoesNotRegenerateAndStaleClientVersionsFail() throws Exception {
        UUID student = directory.addStudent("Удаление");
        Instant start = clock.instant().plusSeconds(86400L * 3);
        MvcTestResult created = post("/lessons", input(student, start, 1));
        String root = id(created);
        String rule = JsonPath.read(body(created), "$.seriesId");
        long version = JsonPath.<Number>read(body(created), "$.version").longValue();
        String updated = edit(start, 1, "ONLY", "Изменено").replace("\"scope\":", "\"version\":" + version + ",\"scope\":");
        assertThat(put(root, updated)).hasStatusOk();
        assertThat(put(root, updated)).hasStatus(HttpStatus.CONFLICT);
        assertThat(mvc.delete().uri("/api/teacher/schedule/lessons/" + root)
                .with(TestUsers.teacher(directory.teacherId()))).hasStatus(HttpStatus.NO_CONTENT);
        jdbc.sql("update schedule.repeat_rules set generated_until = :date where id = :id")
                .param("date", LocalDate.ofInstant(start, ZoneId.of("Europe/Moscow")).minusDays(1))
                .param("id", UUID.fromString(rule)).update();
        schedule.generateOccurrences();
        assertThat(list(student, start)).noneMatch(row -> row.get("startsAt").equals(start.toString()));
    }

    @Test
    void followingCancelAndDeletePreserveChargedAndIndividuallyChangedLessons() throws Exception {
        for (String action : List.of("cancel", "delete")) {
            UUID student = directory.addStudent("Область " + action);
            Instant start = clock.instant().plusSeconds(86400L * 2);
            String root = id(post("/lessons", input(student, start, 1)));
            List<Map<String, Object>> before = list(student, start);
            String charged = before.get(1).get("id").toString();
            assertThat(post("/lessons/" + charged + "/cancel", "{\"byStudent\":true,\"charge\":true}"))
                    .hasStatusOk();
            String completion = jdbc.sql("select completion_id from schedule.lesson_participants where lesson_id = :id")
                    .param("id", UUID.fromString(charged)).query(UUID.class).single().toString();
            String changed = before.get(2).get("id").toString();
            assertThat(put(changed, edit(Instant.parse(before.get(2).get("startsAt").toString()), 1, "ONLY", "Сохранить")))
                    .hasStatusOk();
            if (action.equals("cancel")) {
                assertThat(post("/lessons/" + root + "/cancel", "{\"scope\":\"FOLLOWING\",\"reason\":\"Перерыв\"}"))
                        .hasStatusOk();
                assertThat(list(student, start)).filteredOn(row -> !row.get("id").equals(changed) && !row.get("id").equals(charged))
                        .allMatch(row -> row.get("status").equals("CANCELLED"));
            } else {
                assertThat(mvc.delete().uri("/api/teacher/schedule/lessons/" + root + "?scope=FOLLOWING")
                        .with(TestUsers.teacher(directory.teacherId()))).hasStatus(HttpStatus.NO_CONTENT);
                assertThat(list(student, start)).extracting(row -> row.get("id")).containsExactly(charged, changed);
            }
            schedule.generateOccurrences();
            assertThat(jdbc.sql("select completion_id from schedule.lesson_participants where lesson_id = :id")
                    .param("id", UUID.fromString(charged)).query(UUID.class).single().toString()).isEqualTo(completion);
        }
    }

    @Test
    void repeatChangesRequireFollowingScopeAndRejectStaleRuleVersions() throws Exception {
        UUID student = directory.addStudent("Версия повтора");
        Instant start = clock.instant().plusSeconds(86400L * 2);
        String root = id(post("/lessons", input(student, start, 1)));
        assertThat(put(root, edit(start, 2, "ONLY", "Область"))).hasStatus(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(put(root, edit(start, 2, "FOLLOWING", "Версия").replace("\"scope\":", "\"repeatVersion\":-1,\"scope\":")))
                .hasStatus(HttpStatus.CONFLICT);
        assertThat(put(root, edit(start.plusSeconds(86400L * 8), 3, "FOLLOWING", "Новая фаза")))
                .hasStatusOk().bodyJson().extractingPath("$.repeatWeeks").isEqualTo(3);
        List<Map<String, Object>> changed = list(student, start);
        assertThat(changed).hasSize(4);
        assertThat(changed.get(0).get("id")).isEqualTo(root);
        for (int i = 1; i < changed.size(); i++) {
            assertThat(Instant.parse(changed.get(i).get("startsAt").toString()))
                    .isEqualTo(start.plusSeconds(86400L * (8 + 21 * i)).truncatedTo(java.time.temporal.ChronoUnit.MINUTES));
        }
    }

    @Test
    void conflictsInLaterOccurrencesRollBackTheEntireRepeatAndEndDateIsInclusive() throws Exception {
        UUID student = directory.addStudent("Конфликт");
        Instant start = clock.instant().plusSeconds(86400L * 2);
        id(post("/lessons", input(student, start.plusSeconds(86400L * 7), 0)));
        assertThat(post("/lessons", input(student, start, 1).replace("true", "false")))
                .hasStatus(HttpStatus.CONFLICT);
        assertThat(list(student, start)).hasSize(1);
        String end = LocalDate.ofInstant(start, ZoneId.of("Europe/Moscow")).plusDays(14).toString();
        id(post("/lessons", input(student, start, 1).replace("\"repeatWeeks\":", "\"repeatUntil\":\"" + end + "\",\"repeatWeeks\":")));
        assertThat(list(student, start)).hasSize(4);
        schedule.generateOccurrences();
        assertThat(list(student, start)).hasSize(4);
    }

    @Test
    void theTitleRepeatsButTheTopicStaysWithItsLesson() throws Exception {
        UUID student = directory.addStudent("Название");
        Instant start = clock.instant().plusSeconds(86400L * 2);
        assertThat(post("/lessons", """
                {"studentId":"%s","startsAt":"%s","durationMinutes":60,"repeatWeeks":1,"allowOverlap":true,
                 "title":"Английский","topic":"Времена"}
                """.formatted(student, start))).hasStatus(HttpStatus.CREATED);
        List<Map<String, Object>> lessons = list(student, start);
        assertThat(lessons).hasSizeGreaterThan(1).allSatisfy(row -> assertThat(row.get("title")).isEqualTo("Английский"));
        assertThat(lessons).extracting(row -> row.get("topic")).first().isEqualTo("Времена");
        assertThat(lessons.subList(1, lessons.size())).allSatisfy(row -> assertThat(row.get("topic")).isNull());
    }

    private String input(UUID student, Instant start, int weeks) {
        return "{\"studentId\":\"%s\",\"startsAt\":\"%s\",\"durationMinutes\":60,\"repeatWeeks\":%d,\"allowOverlap\":true}"
                .formatted(student, start, weeks);
    }

    private String edit(Instant start, int weeks, String scope, String title) {
        return "{\"startsAt\":\"%s\",\"durationMinutes\":60,\"repeatWeeks\":%d,\"scope\":\"%s\",\"title\":\"%s\",\"allowOverlap\":true}"
                .formatted(start, weeks, scope, title);
    }

    private MvcTestResult post(String path, String json) {
        return mvc.post().uri("/api/teacher/schedule" + path).with(TestUsers.teacher(directory.teacherId()))
                .contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private MvcTestResult put(String id, String json) {
        return mvc.put().uri("/api/teacher/schedule/lessons/" + id).with(TestUsers.teacher(directory.teacherId()))
                .contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    private List<Map<String, Object>> list(UUID student, Instant start) throws Exception {
        LocalDate from = LocalDate.ofInstant(start, ZoneId.of("Europe/Moscow"));
        return JsonPath.read(body(mvc.get().uri("/api/teacher/schedule/lessons?from={from}&to={to}&studentId={student}",
                from, from.plusDays(120), student).with(TestUsers.teacher(directory.teacherId())).exchange()), "$");
    }

    private String id(MvcTestResult result) throws Exception {
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(body(result), "$.id");
    }

    private String body(MvcTestResult result) throws Exception {
        return result.getResponse().getContentAsString();
    }
}

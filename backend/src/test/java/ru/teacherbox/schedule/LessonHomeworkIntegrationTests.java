package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;
import static ru.teacherbox.schedule.LessonsIntegrationTests.lesson;

import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.testing.FakeAssignments;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The homework of a lesson (roadmap 11): working assignments linked by the teacher, many per lesson. */
@ScheduleIntegrationTest
class LessonHomeworkIntegrationTests extends ScheduleHttpTestSupport {

    private static final ZoneId MOSCOW = ZoneId.of("Europe/Moscow");

    @Autowired
    FakeAssignments assignments;

    @Autowired
    MutableClock clock;

    @Test
    void theTeacherLinksHomeworkToALessonWithoutItsVersion() throws Exception {
        UUID student = directory.addStudent("ДЗ урока");
        String lessonId = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.next(clock), 60, true)));
        String other = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.next(clock), 60, true)));
        UUID first = assignments.add("Упражнения");
        UUID second = assignments.add("Эссе");
        long version = version(lessonId);

        assertThat(link(lessonId, first)).hasStatusOk();
        assertThat(link(lessonId, second)).hasStatusOk().bodyJson().extractingPath("$.assignmentIds")
                .asArray().containsExactly(first.toString(), second.toString());
        assertThat(link(lessonId, first)).as("the same lesson again").hasStatusOk().bodyJson()
                .extractingPath("$.assignmentIds").asArray().hasSize(2);
        assertThat(version(lessonId)).isEqualTo(version);
        LocalDate day = LocalDate.ofInstant(Instant.parse(JsonPath.read(body(get(
                "/api/teacher/schedule/lessons/" + lessonId)), "$.startsAt")), MOSCOW);
        assertThat(JsonPath.<List<List<String>>>read(body(get("/api/teacher/schedule/lessons?from=" + day + "&to="
                + day.plusDays(1) + "&studentId=" + student)), "$[?(@.id == '" + lessonId + "')].assignmentIds"))
                .containsExactly(List.of(first.toString(), second.toString()));

        assertThat(link(other, first)).hasStatus(HttpStatus.CONFLICT).bodyJson().extractingPath("$.code")
                .isEqualTo("schedule.assignment-linked");
        assertThat(link(other, assignments.addToBank("Банк"))).hasStatus(HttpStatus.CONFLICT).bodyJson()
                .extractingPath("$.code").isEqualTo("schedule.bank-item");
        assertThat(link(other, UUID.randomUUID())).hasStatus(HttpStatus.NOT_FOUND).bodyJson()
                .extractingPath("$.code").isEqualTo("assignment.not-found");
        assertThat(link(UUID.randomUUID().toString(), first)).hasStatus(HttpStatus.NOT_FOUND).bodyJson()
                .extractingPath("$.code").isEqualTo("schedule.lesson-not-found");
        assertThat(post("/api/teacher/schedule/lessons/" + other + "/homework", "{}"))
                .hasStatus(HttpStatus.BAD_REQUEST);

        assertThat(delete("/api/teacher/schedule/lessons/" + lessonId + "/homework/" + first)).hasStatusOk()
                .bodyJson().extractingPath("$.assignmentIds").asArray().containsExactly(second.toString());
        assertThat(delete("/api/teacher/schedule/lessons/" + lessonId + "/homework/" + first)).as("not there")
                .hasStatusOk();
        assertThat(delete("/api/teacher/schedule/lessons/" + UUID.randomUUID() + "/homework/" + first))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(link(other, first)).as("free again").hasStatusOk();
    }

    @Test
    void aCancelledLessonTakesNoNewHomeworkButItsHomeworkCanBeTakenOff() throws Exception {
        UUID student = directory.addStudent("Отмена ДЗ");
        String lessonId = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.next(clock), 60, true)));
        UUID assignment = assignments.add("До отмены");
        assertThat(link(lessonId, assignment)).hasStatusOk();
        assertThat(post("/api/teacher/schedule/lessons/" + lessonId + "/cancel", "{}")).hasStatusOk();

        assertThat(link(lessonId, assignments.add("После отмены"))).hasStatus(HttpStatus.UNPROCESSABLE_ENTITY)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.lesson-cancelled");
        assertThat(delete("/api/teacher/schedule/lessons/" + lessonId + "/homework/" + assignment)).hasStatusOk()
                .bodyJson().extractingPath("$.assignmentIds").asArray().isEmpty();
    }

    @Test
    void aDeletedLessonFreesItsHomework() throws Exception {
        UUID student = directory.addStudent("Удалённый урок");
        String lessonId = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.next(clock), 60, true)));
        String other = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.next(clock), 60, true)));
        UUID assignment = assignments.add("Переедет");
        assertThat(link(lessonId, assignment)).hasStatusOk();

        assertThat(delete("/api/teacher/schedule/lessons/" + lessonId)).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(link(other, assignment)).hasStatusOk();
    }

    @Test
    void onlyTheTeacherLinksHomeworkAndTheStudentSeesNoIds() throws Exception {
        UUID student = directory.addStudent("Ученик с ДЗ");
        String lessonId = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.next(clock), 60, true)));
        UUID assignment = assignments.add("Чтение");
        assertThat(link(lessonId, assignment)).hasStatusOk();

        assertThat(mvc.post().uri("/api/teacher/schedule/lessons/" + lessonId + "/homework")
                .with(TestUsers.student(student)).contentType("application/json")
                .content("{\"assignmentId\":\"" + assignment + "\"}")).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.delete().uri("/api/teacher/schedule/lessons/" + lessonId + "/homework/" + assignment)
                .with(TestUsers.student(student))).hasStatus(HttpStatus.FORBIDDEN);
        MvcTestResult own = mvc.get().uri("/api/me/schedule/lessons/" + lessonId).with(TestUsers.student(student))
                .exchange();
        assertThat(own).hasStatusOk().bodyJson().extractingPath("$.assignmentIds").asArray().isEmpty();
    }

    @Test
    void aFollowingSeriesEditKeepsALessonWithHomework() throws Exception {
        UUID student = directory.addStudent("Серия с ДЗ");
        Instant start = Slots.seriesStart(clock, 2);
        String root = id(post("/api/teacher/schedule/lessons", """
                {"studentId":"%s","startsAt":"%s","durationMinutes":60,"repeatWeeks":1,"allowOverlap":true}
                """.formatted(student, start)));
        List<String> before = lessonIds(student, start);
        String prepared = before.get(2);
        String untouched = before.get(3);
        UUID assignment = assignments.add("Подготовлено");
        assertThat(link(prepared, assignment)).hasStatusOk();

        assertThat(put("/api/teacher/schedule/lessons/" + root, """
                {"startsAt":"%s","durationMinutes":90,"repeatWeeks":1,"scope":"FOLLOWING","allowOverlap":true}
                """.formatted(start))).hasStatusOk();

        List<String> after = lessonIds(student, start);
        assertThat(after).contains(root, prepared).doesNotContain(untouched);
        assertThat(get("/api/teacher/schedule/lessons/" + prepared)).hasStatusOk().bodyJson()
                .extractingPath("$.assignmentIds").asArray().containsExactly(assignment.toString());
    }

    private MvcTestResult link(String lessonId, UUID assignmentId) {
        return post("/api/teacher/schedule/lessons/" + lessonId + "/homework",
                "{\"assignmentId\":\"" + assignmentId + "\"}");
    }

    private long version(String lessonId) throws Exception {
        return JsonPath.<Number>read(body(get("/api/teacher/schedule/lessons/" + lessonId)), "$.version")
                .longValue();
    }

    private List<String> lessonIds(UUID student, Instant start) throws Exception {
        LocalDate from = LocalDate.ofInstant(start, MOSCOW);
        return JsonPath.read(body(get("/api/teacher/schedule/lessons?from=" + from + "&to=" + from.plusDays(60)
                + "&studentId=" + student)), "$[*].id");
    }

    private static String body(MvcTestResult result) throws Exception {
        return result.getResponse().getContentAsString();
    }
}

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
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.schedule.api.LessonSummaryShared;
import ru.teacherbox.testing.FakeGuardians;
import ru.teacherbox.testing.FakeLessonPlans;
import ru.teacherbox.testing.FakeTextbooks;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;
import ru.teacherbox.textbooks.api.LessonPlanView;
import ru.teacherbox.textbooks.api.TextbookFormat;
import ru.teacherbox.textbooks.api.TextbookKind;
import ru.teacherbox.textbooks.api.VideoLink;

/** The lesson plan of a lesson (ADR-0071): linked by the teacher, read by the student and the guardian. */
@ScheduleIntegrationTest
class LessonPlanIntegrationTests extends ScheduleHttpTestSupport {

    private static final ZoneId MOSCOW = ZoneId.of("Europe/Moscow");

    @Autowired
    FakeLessonPlans plans;

    @Autowired
    FakeTextbooks textbooks;

    @Autowired
    FakeGuardians guardians;

    @Autowired
    MutableClock clock;

    @Test
    void theTeacherPutsAWorkingPlanOnALessonWithoutItsVersion() throws Exception {
        UUID student = directory.addStudent("План");
        String lessonId = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.next(clock), 60, true)));
        String other = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.next(clock), 60, true)));
        UUID plan = plans.add("Времена", List.of(), List.of());
        long version = version(lessonId);

        assertThat(plan(lessonId, plan)).hasStatusOk().bodyJson().extractingPath("$.planId")
                .isEqualTo(plan.toString());
        assertThat(plan(lessonId, plan)).as("the same plan again").hasStatusOk();
        assertThat(version(lessonId)).isEqualTo(version);
        assertThat(get("/api/teacher/schedule/lessons/" + lessonId)).hasStatusOk().bodyJson()
                .extractingPath("$.planId").isEqualTo(plan.toString());
        LocalDate day = LocalDate.ofInstant(Instant.parse(JsonPath.read(body(get(
                "/api/teacher/schedule/lessons/" + lessonId)), "$.startsAt")), MOSCOW);
        assertThat(JsonPath.<List<String>>read(body(get("/api/teacher/schedule/lessons?from=" + day + "&to="
                + day.plusDays(1) + "&studentId=" + student)), "$[?(@.id == '" + lessonId + "')].planId"))
                .containsExactly(plan.toString());

        assertThat(plan(other, plan)).hasStatus(HttpStatus.CONFLICT).bodyJson().extractingPath("$.code")
                .isEqualTo("schedule.plan-linked");
        assertThat(plan(other, plans.addToBank("Банк"))).hasStatus(HttpStatus.CONFLICT).bodyJson()
                .extractingPath("$.code").isEqualTo("schedule.bank-item");
        assertThat(plan(other, UUID.randomUUID())).hasStatus(HttpStatus.NOT_FOUND).bodyJson()
                .extractingPath("$.code").isEqualTo("textbooks.plan-not-found");
        assertThat(plan(UUID.randomUUID().toString(), plan)).hasStatus(HttpStatus.NOT_FOUND).bodyJson()
                .extractingPath("$.code").isEqualTo("schedule.lesson-not-found");

        assertThat(put("/api/teacher/schedule/lessons/" + lessonId + "/plan", "{\"planId\":null}")).hasStatusOk()
                .bodyJson().extractingPath("$.planId").isNull();
        assertThat(plan(other, plan)).as("free again").hasStatusOk();
    }

    @Test
    void aCancelledLessonTakesNoNewPlanButItsPlanCanBeTakenOff() throws Exception {
        UUID student = directory.addStudent("Отмена плана");
        String lessonId = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.next(clock), 60, true)));
        UUID plan = plans.add("До отмены", List.of(), List.of());
        assertThat(plan(lessonId, plan)).hasStatusOk();
        assertThat(post("/api/teacher/schedule/lessons/" + lessonId + "/cancel", "{}")).hasStatusOk();

        assertThat(plan(lessonId, plans.add("После отмены", List.of(), List.of())))
                .hasStatus(HttpStatus.UNPROCESSABLE_ENTITY).bodyJson().extractingPath("$.code")
                .isEqualTo("schedule.lesson-cancelled");
        assertThat(put("/api/teacher/schedule/lessons/" + lessonId + "/plan", "{}")).hasStatusOk().bodyJson()
                .extractingPath("$.planId").isNull();
    }

    @Test
    void aStudentReadsThePlanOfTheirLessonWithShownTranscriptsOnly() throws Exception {
        UUID student = directory.addStudent("Ученик плана");
        UUID stranger = directory.addStudent("Чужой ученик");
        String lessonId = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.next(clock), 60, true)));
        String bare = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.next(clock), 60, true)));
        UUID pdf = textbooks.add("Grammar", TextbookFormat.PDF, 40);
        UUID whole = textbooks.add("Dictionary", TextbookFormat.PDF, 10);
        UUID plan = plans.add("Урок 5", List.of(textbook(pdf, "Grammar", "3-4"), textbook(whole, "Dictionary", null)),
                List.of(video("Скрыто", false), video("Видно", true)));
        assertThat(plan(lessonId, plan)).hasStatusOk();
        String base = "/api/me/schedule/lessons/" + lessonId + "/plan";

        MvcTestResult read = as(student, base);
        assertThat(read).hasStatusOk();
        String json = body(read);
        assertThat(JsonPath.<String>read(json, "$.title")).isEqualTo("Урок 5");
        assertThat(JsonPath.<List<String>>read(json, "$.textbooks[*].pages")).containsExactly("3-4", null);
        assertThat(JsonPath.<List<String>>read(json, "$.videos[*].transcript")).containsExactly(null, "Видно");
        assertThat(json).doesNotContain("Скрыто");
        assertThat(JsonPath.<String>read(body(as(student, "/api/me/schedule/lessons/" + lessonId)), "$.planId"))
                .isEqualTo(plan.toString());

        assertThat(as(student, base + "/textbooks/" + pdf)).hasStatusOk().hasBodyTextEqualTo("Grammar pages 3-4");
        assertThat(as(student, base + "/textbooks/" + whole)).hasStatusOk().hasBodyTextEqualTo("Dictionary");
        assertThat(as(student, base + "/textbooks/" + UUID.randomUUID())).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.textbook-not-found");

        assertThat(as(stranger, base)).hasStatus(HttpStatus.NOT_FOUND).bodyJson().extractingPath("$.code")
                .isEqualTo("schedule.lesson-not-found");
        assertThat(as(stranger, base + "/textbooks/" + pdf)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(as(student, "/api/me/schedule/lessons/" + bare + "/plan")).hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.plan-not-found");
        assertThat(mvc.get().uri(base).with(teacher())).hasStatus(HttpStatus.FORBIDDEN);

        plans.remove(plan);
        assertThat(as(student, base)).as("a deleted plan").hasStatus(HttpStatus.NOT_FOUND).bodyJson()
                .extractingPath("$.code").isEqualTo("schedule.plan-not-found");
    }

    @Test
    void aGuardianReadsTheChildsPlanAndNoOtherOne() throws Exception {
        UUID child = directory.addStudent("Ребёнок плана");
        UUID otherChild = directory.addStudent("Другой ребёнок");
        UUID parent = guardians.addGuardian("Родитель плана", child);
        String lessonId = id(post("/api/teacher/schedule/lessons", lesson(child, Slots.next(clock), 60, true)));
        String foreign = id(post("/api/teacher/schedule/lessons", lesson(otherChild, Slots.next(clock), 60, true)));
        UUID pdf = textbooks.add("Workbook", TextbookFormat.PDF, 20);
        UUID plan = plans.add("Для родителя", List.of(textbook(pdf, "Workbook", "2")), List.of(video("Текст", false)));
        assertThat(plan(lessonId, plan)).hasStatusOk();
        assertThat(plan(foreign, plans.add("Чужой", List.of(), List.of()))).hasStatusOk();
        String base = "/api/guardian/students/" + child + "/schedule/lessons/";

        MvcTestResult read = guardian(parent, base + lessonId + "/plan");
        assertThat(read).hasStatusOk().bodyJson().extractingPath("$.title").isEqualTo("Для родителя");
        assertThat(JsonPath.<List<String>>read(body(read), "$.videos[*].transcript")).containsExactly((String) null);
        assertThat(guardian(parent, base + lessonId + "/plan/textbooks/" + pdf)).hasStatusOk()
                .hasBodyTextEqualTo("Workbook pages 2");

        assertThat(guardian(parent, base + foreign + "/plan")).as("another student's lesson")
                .hasStatus(HttpStatus.NOT_FOUND);
        String notTheirChild = "/api/guardian/students/" + otherChild + "/schedule/lessons/" + foreign;
        assertThat(guardian(parent, notTheirChild + "/plan")).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(guardian(parent, notTheirChild + "/plan/textbooks/" + pdf)).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void withAPlanTheSummaryHoldsTheDeviationsAndIsSentEvenWithout(AssertablePublishedEvents events)
            throws Exception {
        UUID student = directory.addStudent("По плану");
        UUID stranger = directory.addStudent("Без плана");
        String lessonId = id(post("/api/teacher/schedule/lessons", lesson(student, Slots.past(clock), 60, true)));
        String bare = id(post("/api/teacher/schedule/lessons", lesson(stranger, Slots.past(clock), 60, true)));
        put("/api/teacher/schedule/lessons/" + lessonId + "/outcome", "{\"outcome\":\"CONDUCTED\"}");
        put("/api/teacher/schedule/lessons/" + bare + "/outcome", "{\"outcome\":\"CONDUCTED\"}");
        UUID plan = plans.add("Времена", List.of(), List.of());
        assertThat(plan(lessonId, plan)).hasStatusOk();

        assertThat(post("/api/teacher/schedule/lessons/" + lessonId + "/summary/share", ""))
                .as("all by the plan").hasStatus(HttpStatus.NO_CONTENT);
        assertThat(events).contains(LessonSummaryShared.class)
                .matching(LessonSummaryShared::lessonId, UUID.fromString(lessonId));
        assertThat(post("/api/teacher/schedule/lessons/" + bare + "/summary/share", ""))
                .as("no plan, nothing written").hasStatus(HttpStatus.UNPROCESSABLE_ENTITY);

        put("/api/teacher/schedule/lessons/" + lessonId + "/summary", "{\"summary\":\"Не успели упр. 5\"}");
        assertThat(get("/api/teacher/schedule/students/" + student + "/history")).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$[0].planId").isEqualTo(plan.toString());
                    assertThat(json).extractingPath("$[0].summary").isEqualTo("Не успели упр. 5");
                });
        assertThat(as(student, "/api/me/schedule/history")).hasStatusOk().bodyJson()
                .extractingPath("$[0].planId").isEqualTo(plan.toString());
        assertThat(as(stranger, "/api/me/schedule/history")).hasStatusOk().bodyJson()
                .extractingPath("$[0].planId").isNull();
    }

    @Test
    void aFollowingSeriesEditKeepsAPreparedLesson() throws Exception {
        UUID student = directory.addStudent("Серия с планом");
        Instant start = Slots.seriesStart(clock, 2);
        String root = id(post("/api/teacher/schedule/lessons", """
                {"studentId":"%s","startsAt":"%s","durationMinutes":60,"repeatWeeks":1,"allowOverlap":true}
                """.formatted(student, start)));
        List<String> before = lessonIds(student, start);
        String prepared = before.get(2);
        String untouched = before.get(3);
        UUID plan = plans.add("Подготовлено", List.of(), List.of());
        assertThat(plan(prepared, plan)).hasStatusOk();

        assertThat(put("/api/teacher/schedule/lessons/" + root, """
                {"startsAt":"%s","durationMinutes":90,"repeatWeeks":1,"scope":"FOLLOWING","allowOverlap":true}
                """.formatted(start))).hasStatusOk();

        List<String> after = lessonIds(student, start);
        assertThat(after).contains(root, prepared).doesNotContain(untouched);
        assertThat(get("/api/teacher/schedule/lessons/" + prepared)).hasStatusOk().bodyJson()
                .extractingPath("$.planId").isEqualTo(plan.toString());
    }

    private MvcTestResult plan(String lessonId, UUID planId) {
        return put("/api/teacher/schedule/lessons/" + lessonId + "/plan", "{\"planId\":\"" + planId + "\"}");
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

    private MvcTestResult as(UUID student, String uri) {
        return mvc.get().uri(uri).with(TestUsers.student(student)).exchange();
    }

    private MvcTestResult guardian(UUID guardian, String uri) {
        RequestPostProcessor user = TestUsers.guardian(guardian);
        return mvc.get().uri(uri).with(user).exchange();
    }

    private static String body(MvcTestResult result) throws Exception {
        return result.getResponse().getContentAsString();
    }

    private static LessonPlanView.Textbook textbook(UUID id, String title, @Nullable String pages) {
        return new LessonPlanView.Textbook(id, title, TextbookKind.TEXTBOOK, TextbookFormat.PDF, pages);
    }

    private static LessonPlanView.Video video(String transcript, boolean shown) {
        return new LessonPlanView.Video("https://www.youtube.com/watch?v=dQw4w9WgXcQ", VideoLink.Provider.YOUTUBE,
                "dQw4w9WgXcQ", null, null, transcript, shown);
    }
}

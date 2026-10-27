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
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The history of held lessons with their summaries: the teacher's feed and the student's own. */
@ScheduleIntegrationTest
class LessonHistoryIntegrationTests extends ScheduleHttpTestSupport {

    private static final String LESSONS = "/api/teacher/schedule/lessons/";

    @Autowired
    MutableClock clock;

    @Autowired
    FakeStudentGroups groups;

    @Test
    void theStudentHistoryHoldsOnlyHeldLessonsNewestFirstWithTheOwnNote() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        Instant older = Slots.past(clock);
        String first = held(anna, older.minus(Duration.ofDays(1)));
        String second = held(anna, older);
        held(boris, older.plus(Duration.ofHours(5)));
        String planned = id(post("/api/teacher/schedule/lessons", lesson(anna, Slots.next(clock), 60, true)));
        String cancelled = id(post("/api/teacher/schedule/lessons", lesson(anna, Slots.next(clock), 60, true)));
        post(LESSONS + cancelled + "/cancel", "{}");
        put(LESSONS + planned + "/summary", "{\"summary\":\"Рано\"}");
        put(LESSONS + first + "/summary", "{\"summary\":\"Past Simple\",\"nextPlan\":\"Повторить\"}");
        put(LESSONS + first + "/notes/" + anna, "{\"note\":\"Личное\"}");

        assertThat(get("/api/teacher/schedule/students/" + anna + "/history")).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.length()").isEqualTo(2);
                    assertThat(json).extractingPath("$[0].lessonId").isEqualTo(second);
                    assertThat(json).extractingPath("$[0].summary").isNull();
                    assertThat(json).extractingPath("$[1].lessonId").isEqualTo(first);
                    assertThat(json).extractingPath("$[1].status").isEqualTo("CONDUCTED");
                    assertThat(json).extractingPath("$[1].summary").isEqualTo("Past Simple");
                    assertThat(json).extractingPath("$[1].nextPlan").isEqualTo("Повторить");
                    assertThat(json).extractingPath("$[1].note").isEqualTo("Личное");
                });
    }

    @Test
    void pagesByTheBeforeInstant() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        Instant base = Slots.past(clock);
        String newest = held(anna, base);
        String middle = held(anna, base.minus(Duration.ofDays(1)));
        String oldest = held(anna, base.minus(Duration.ofDays(2)));
        String uri = "/api/teacher/schedule/students/" + anna + "/history";

        assertThat(get(uri + "?limit=2")).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.length()").isEqualTo(2);
            assertThat(json).extractingPath("$[1].lessonId").isEqualTo(middle);
        });
        assertThat(get(uri + "?limit=2&before=" + base.minus(Duration.ofDays(1)))).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.length()").isEqualTo(1);
            assertThat(json).extractingPath("$[0].lessonId").isEqualTo(oldest);
        });
        assertThat(get(uri + "?before=" + base.plusSeconds(1))).bodyJson().extractingPath("$[0].lessonId")
                .isEqualTo(newest);
        assertThat(get(uri + "?limit=0")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(get(uri + "?limit=101")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void theGroupHistoryHasTheSharedSummaryAndNoPrivateNotes() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        UUID group = groups.addGroup("ОГЭ", anna, boris);
        UUID other = groups.addGroup("ЕГЭ", boris);
        String lesson = id(post("/api/teacher/schedule/lessons", groupLesson(group, Slots.past(clock))));
        put(LESSONS + lesson + "/attendance", "{\"marks\":{\"" + anna + "\":\"ATTENDED\",\"" + boris
                + "\":\"EXCUSED\"}}");
        put(LESSONS + lesson + "/summary", "{\"summary\":\"Общий итог\"}");
        put(LESSONS + lesson + "/notes/" + anna, "{\"note\":\"Личное про Анну\"}");
        String otherLesson = id(post("/api/teacher/schedule/lessons", groupLesson(other, Slots.past(clock))));
        put(LESSONS + otherLesson + "/attendance", "{\"marks\":{\"" + boris + "\":\"ATTENDED\"}}");

        var response = get("/api/teacher/schedule/groups/" + group + "/history");
        assertThat(response).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.length()").isEqualTo(1);
            assertThat(json).extractingPath("$[0].lessonId").isEqualTo(lesson);
            assertThat(json).extractingPath("$[0].summary").isEqualTo("Общий итог");
            assertThat(json).extractingPath("$[0].groupName").isEqualTo("ОГЭ");
        });
        assertThat(response.getResponse().getContentAsString()).doesNotContain("Личное");
        // a group lesson is in the history of each participant, the excused one included
        assertThat(get("/api/teacher/schedule/students/" + boris + "/history")).bodyJson()
                .extractingPath("$.length()").isEqualTo(2);
    }

    @Test
    void aStudentSeesOnlyTheirOwnLessonsWithTheSummaryOnly() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        String mine = held(anna, Slots.past(clock));
        String theirs = held(boris, Slots.past(clock));
        put(LESSONS + mine + "/summary", "{\"summary\":\"Мои итоги\",\"nextPlan\":\"План\"}");
        put(LESSONS + mine + "/notes/" + anna, "{\"note\":\"Личное\"}");
        put(LESSONS + theirs + "/summary", "{\"summary\":\"Чужие итоги\"}");

        var response = mvc.get().uri("/api/me/schedule/history").with(TestUsers.student(anna)).exchange();

        assertThat(response).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.length()").isEqualTo(1);
            assertThat(json).extractingPath("$[0].lessonId").isEqualTo(mine);
            assertThat(json).extractingPath("$[0].summary").isEqualTo("Мои итоги");
            assertThat(json).extractingPath("$[0].nextPlan").isNull();
            assertThat(json).extractingPath("$[0].note").isNull();
        });
        assertThat(response.getResponse().getContentAsString()).doesNotContain("Чужие").doesNotContain("Личное");
    }

    @Test
    void historyEndpointsAreForTheRightRoles() {
        UUID anna = directory.addStudent("Анна");
        UUID group = groups.addGroup("ОГЭ", anna);
        for (String uri : new String[] {"/api/teacher/schedule/students/" + anna + "/history",
                "/api/teacher/schedule/groups/" + group + "/history"}) {
            assertThat(mvc.get().uri(uri).with(TestUsers.student(anna)).exchange()).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(mvc.get().uri(uri).exchange()).hasStatus(HttpStatus.UNAUTHORIZED);
        }
        assertThat(mvc.get().uri("/api/me/schedule/history").exchange()).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    private String held(UUID student, Instant startsAt) throws UnsupportedEncodingException {
        String lesson = id(post("/api/teacher/schedule/lessons", lesson(student, startsAt, 60, true)));
        put(LESSONS + lesson + "/outcome", "{\"outcome\":\"CONDUCTED\"}");
        return lesson;
    }

    private static String groupLesson(UUID group, Instant start) {
        return """
                {"groupId":"%s","startsAt":"%s","durationMinutes":60,"allowOverlap":true}
                """.formatted(group, start);
    }
}

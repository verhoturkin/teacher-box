package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;
import static ru.teacherbox.schedule.LessonsIntegrationTests.lesson;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.AssertablePublishedEvents;
import ru.teacherbox.schedule.api.LessonSummaryShared;
import ru.teacherbox.schedule.persistence.LessonRepository;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The summary of a lesson, the plan for the next one and the teacher's old private notes (read-only). */
@ScheduleIntegrationTest
class LessonNotesIntegrationTests extends ScheduleHttpTestSupport {

    private static final String LESSONS = "/api/teacher/schedule/lessons/";

    @Autowired
    MutableClock clock;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    LessonRepository lessons;

    @Test
    void theTeacherWritesTheSummaryAndTheStudentReadsOnlyIt() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        String lesson = id(post("/api/teacher/schedule/lessons", lesson(anna, Slots.past(clock), 60, true)));

        assertThat(put(LESSONS + lesson + "/summary", "{\"summary\":\"  Past Simple \",\"nextPlan\":\"Повторить\"}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.summary").isEqualTo("Past Simple");
                    assertThat(json).extractingPath("$.nextPlan").isEqualTo("Повторить");
                    assertThat(json).extractingPath("$.summaryUpdatedAt").isNotNull();
                });
        oldNote(lesson, anna, "Устала");
        assertThat(get(LESSONS + lesson)).bodyJson().extractingPath("$.notes[0].note").isEqualTo("Устала");
        assertThat(get(LESSONS + lesson)).bodyJson().extractingPath("$.notes[0].studentId")
                .isEqualTo(anna.toString());

        assertThat(mvc.get().uri("/api/me/schedule/lessons/" + lesson).with(TestUsers.student(anna)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.summary").isEqualTo("Past Simple");
                    assertThat(json).extractingPath("$.nextPlan").isNull();
                    assertThat(json).extractingPath("$.notes").asArray().isEmpty();
                });
    }

    @Test
    void blankTextClearsAndTheEditNeverBumpsTheLessonVersion() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        String lesson = id(post("/api/teacher/schedule/lessons", lesson(anna, Slots.past(clock), 60, true)));
        Object version = JsonPath.read(get(LESSONS + lesson).getResponse().getContentAsString(), "$.version");

        put(LESSONS + lesson + "/summary", "{\"summary\":\"Итоги\"}");
        oldNote(lesson, anna, "Заметка");
        assertThat(JsonPath.<Object>read(get(LESSONS + lesson).getResponse().getContentAsString(), "$.version"))
                .isEqualTo(version);

        assertThat(put(LESSONS + lesson + "/summary", "{\"summary\":\"  \"}")).hasStatusOk().bodyJson()
                .extractingPath("$.summary").isNull();
    }

    @Test
    void invalidWritesAreRejected() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        String lesson = id(post("/api/teacher/schedule/lessons", lesson(anna, Slots.past(clock), 60, true)));
        String cancelled = id(post("/api/teacher/schedule/lessons", lesson(anna, Slots.past(clock), 60, true)));
        post(LESSONS + cancelled + "/cancel", "{}");

        assertThat(put(LESSONS + lesson + "/summary", "{\"summary\":\"" + "я".repeat(4001) + "\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(put(LESSONS + lesson + "/summary", "{\"nextPlan\":\"" + "я".repeat(1001) + "\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(put(LESSONS + cancelled + "/summary", "{\"summary\":\"x\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(put(LESSONS + UUID.randomUUID() + "/summary", "{}")).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void onlyTheTeacherWritesAndOnlyParticipantsRead() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID stranger = directory.addStudent("Чужой");
        String lesson = id(post("/api/teacher/schedule/lessons", lesson(anna, Slots.past(clock), 60, true)));
        put(LESSONS + lesson + "/summary", "{\"summary\":\"Секрет\"}");

        assertThat(mvc.put().uri(LESSONS + lesson + "/summary").with(TestUsers.student(anna))
                .contentType(MediaType.APPLICATION_JSON).content("{}")).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.put().uri(LESSONS + lesson + "/summary").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(mvc.get().uri("/api/me/schedule/lessons/" + lesson).with(TestUsers.student(stranger)))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void sharingPublishesTheEventOnlyForAWrittenSummary(AssertablePublishedEvents events)
            throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        String lesson = id(post("/api/teacher/schedule/lessons", lesson(anna, Slots.past(clock), 60, true)));

        assertThat(post(LESSONS + lesson + "/summary/share", ""))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        put(LESSONS + lesson + "/summary", "{\"summary\":\"   \"}");
        assertThat(post(LESSONS + lesson + "/summary/share", ""))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(events.ofType(LessonSummaryShared.class)).isEmpty();

        put(LESSONS + lesson + "/summary", "{\"summary\":\"Итоги\"}");
        assertThat(events.ofType(LessonSummaryShared.class)).isEmpty();
        assertThat(post(LESSONS + lesson + "/summary/share", ""))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(events).contains(LessonSummaryShared.class)
                .matching(LessonSummaryShared::lessonId, UUID.fromString(lesson))
                .matching(LessonSummaryShared::studentIds, List.of(anna));

        assertThat(mvc.post().uri(LESSONS + lesson + "/summary/share").with(TestUsers.student(anna)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(post(LESSONS + UUID.randomUUID() + "/summary/share", ""))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void theCalendarListsCarryNoSummaryOrNotes() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        Instant start = Slots.past(clock);
        String lesson = id(post("/api/teacher/schedule/lessons", lesson(anna, start, 60, true)));
        put(LESSONS + lesson + "/summary", "{\"summary\":\"Итоги дня\",\"nextPlan\":\"Повторить Past Perfect\"}");
        oldNote(lesson, anna, "Личное");
        LocalDate day = start.atZone(ZoneId.of("Europe/Moscow")).toLocalDate();

        String teacherList = get("/api/teacher/schedule/lessons?from=" + day + "&to=" + day.plusDays(2))
                .getResponse().getContentAsString();
        String studentList = mvc.get().uri("/api/me/schedule/lessons?from={f}&to={t}", day, day.plusDays(2))
                .with(TestUsers.student(anna)).exchange().getResponse().getContentAsString();

        assertThat(teacherList).contains(lesson).doesNotContain("Итоги дня").doesNotContain("Повторить Past Perfect")
                .doesNotContain("Личное");
        assertThat(studentList).contains(lesson).doesNotContain("Итоги дня").doesNotContain("Повторить Past Perfect")
                .doesNotContain("Личное");
    }

    @Test
    void theNextPlanFillsOnlyAnEmptyTopicOfTheNextLessonOfTheSameStudent() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID boris = directory.addStudent("Борис");
        Instant start = Slots.past(clock);
        String first = id(post("/api/teacher/schedule/lessons", lesson(anna, start, 60, true)));
        String second = id(post("/api/teacher/schedule/lessons", lesson(anna, start.plus(Duration.ofDays(2)), 60, true)));
        String third = id(post("/api/teacher/schedule/lessons", lesson(anna, start.plus(Duration.ofDays(3)), 60, true)));
        String other = id(post("/api/teacher/schedule/lessons", lesson(boris, start.plus(Duration.ofDays(1)), 60, true)));

        put(LESSONS + first + "/summary", "{\"nextPlan\":\"Условные предложения\"}");

        assertThat(topic(second)).isEqualTo("Условные предложения");
        assertThat(JsonPath.<String>read(get(LESSONS + second).getResponse().getContentAsString(), "$.title"))
                .as("the plan goes into the topic, never the title").isNull();
        assertThat(topic(third)).isNull();
        assertThat(topic(other)).isNull();

        put(LESSONS + first + "/summary", "{\"nextPlan\":\"Другое\"}");
        assertThat(topic(second)).isEqualTo("Условные предложения");
        put(LESSONS + second + "/summary", "{\"nextPlan\":\"Дальше\"}");
        assertThat(topic(third)).isEqualTo("Дальше");
        put(LESSONS + third + "/summary", "{\"summary\":\"Только итоги\"}");
        assertThat(topic(third)).isEqualTo("Дальше");
    }

    @Test
    void theNextPlanOfAGroupLessonGoesToTheNextLessonOfTheGroupAndIsCutToTheTopicLength()
            throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        UUID group = groups.addGroup("ОГЭ", anna);
        Instant start = Slots.past(clock);
        String first = id(post("/api/teacher/schedule/lessons", groupLesson(group, start)));
        String single = id(post("/api/teacher/schedule/lessons", lesson(anna, start.plus(Duration.ofDays(1)), 60, true)));
        String second = id(post("/api/teacher/schedule/lessons", groupLesson(group, start.plus(Duration.ofDays(2)))));

        put(LESSONS + first + "/summary", "{\"nextPlan\":\"" + "ы".repeat(900) + "\"}");

        assertThat(topic(second)).hasSize(500);
        assertThat(topic(single)).isNull();
    }

    @Test
    void aLessonThatHasNotStartedHasNoSummaryNoNoteAndCannotBeShared() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        String lesson = id(post("/api/teacher/schedule/lessons", lesson(anna, Slots.next(clock), 60, true)));

        for (var result : List.of(put(LESSONS + lesson + "/summary", "{\"summary\":\"Рано\"}"),
                post(LESSONS + lesson + "/summary/share", ""))) {
            assertThat(result).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyText()
                    .contains("schedule.lesson-not-started");
        }
    }

    @Test
    void aMissedIndividualLessonHasNoSummaryButAMissedGroupLessonKeepsIt() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        String missed = id(post("/api/teacher/schedule/lessons", lesson(anna, Slots.past(clock), 60, true)));
        put(LESSONS + missed + "/outcome", "{\"outcome\":\"MISSED\"}");

        for (var result : List.of(put(LESSONS + missed + "/summary", "{\"summary\":\"Нет\"}"),
                post(LESSONS + missed + "/summary/share", ""))) {
            assertThat(result).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyText()
                    .contains("schedule.lesson-missed");
        }

        UUID group = groups.addGroup("ОГЭ", anna);
        String groupLesson = id(post("/api/teacher/schedule/lessons", groupLesson(group, Slots.past(clock))));
        put(LESSONS + groupLesson + "/attendance", "{\"marks\":{\"" + anna + "\":\"MISSED\"}}");
        assertThat(put(LESSONS + groupLesson + "/summary", "{\"summary\":\"Итоги\"}")).hasStatusOk();
    }

    @Test
    void deletingALessonDeletesItsNotes() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        String lesson = id(post("/api/teacher/schedule/lessons", lesson(anna, Slots.past(clock), 60, true)));
        oldNote(lesson, anna, "Личное");
        assertThat(lessons.findNotes(UUID.fromString(lesson))).hasSize(1);

        assertThat(delete(LESSONS + lesson)).hasStatus(HttpStatus.NO_CONTENT);

        assertThat(lessons.findNotes(UUID.fromString(lesson))).isEmpty();
    }

    @Test
    void privateNotesAreNoLongerWrittenButTheOldOnesAreReadByTheTeacherOnly() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        String lesson = id(post("/api/teacher/schedule/lessons", lesson(anna, Slots.past(clock), 60, true)));

        assertThat(put(LESSONS + lesson + "/notes/" + anna, "{\"note\":\"Новая\"}")).hasStatus4xxClientError();
        assertThat(lessons.findNotes(UUID.fromString(lesson))).isEmpty();

        oldNote(lesson, anna, "Старая");
        assertThat(get(LESSONS + lesson)).bodyJson().extractingPath("$.notes[0].note").isEqualTo("Старая");
        assertThat(mvc.get().uri(LESSONS + lesson).with(TestUsers.student(anna))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(LESSONS + lesson).with(TestUsers.admin(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/schedule/lessons/" + lesson).with(TestUsers.student(anna)))
                .hasStatusOk().bodyText().doesNotContain("Старая");
    }

    private String topic(String lessonId) throws UnsupportedEncodingException {
        return JsonPath.read(get(LESSONS + lessonId).getResponse().getContentAsString(), "$.topic");
    }

    private static String groupLesson(UUID group, Instant start) {
        return """
                {"groupId":"%s","startsAt":"%s","durationMinutes":60,"allowOverlap":true}
                """.formatted(group, start);
    }
}

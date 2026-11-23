package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;
import static ru.teacherbox.schedule.LessonsIntegrationTests.lesson;

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

        assertThat(put(LESSONS + lesson + "/summary", "{\"summary\":\"  Past Simple \"}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.summary").isEqualTo("Past Simple");
                    assertThat(json).extractingPath("$.summaryUpdatedAt").isNotNull();
                });
        oldNote(lesson, anna, "Устала");
        assertThat(get(LESSONS + lesson)).bodyJson().extractingPath("$.notes[0].note").isEqualTo("Устала");
        assertThat(get(LESSONS + lesson)).bodyJson().extractingPath("$.notes[0].studentId")
                .isEqualTo(anna.toString());

        assertThat(mvc.get().uri("/api/me/schedule/lessons/" + lesson).with(TestUsers.student(anna)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.summary").isEqualTo("Past Simple");
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
    void theCalendarListsCarryNoSummaryOrNotes() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        Instant start = Slots.past(clock);
        String lesson = id(post("/api/teacher/schedule/lessons", lesson(anna, start, 60, true)));
        put(LESSONS + lesson + "/summary", "{\"summary\":\"Итоги дня\"}");
        oldNote(lesson, anna, "Личное");
        LocalDate day = start.atZone(ZoneId.of("Europe/Moscow")).toLocalDate();

        String teacherList = get("/api/teacher/schedule/lessons?from=" + day + "&to=" + day.plusDays(2))
                .getResponse().getContentAsString();
        String studentList = mvc.get().uri("/api/me/schedule/lessons?from={f}&to={t}", day, day.plusDays(2))
                .with(TestUsers.student(anna)).exchange().getResponse().getContentAsString();

        assertThat(teacherList).contains(lesson).doesNotContain("Итоги дня").doesNotContain("Личное");
        assertThat(studentList).contains(lesson).doesNotContain("Итоги дня").doesNotContain("Личное");
    }

    @Test
    void aLessonThatHasNotStartedHasNoSummary() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        String lesson = id(post("/api/teacher/schedule/lessons", lesson(anna, Slots.next(clock), 60, true)));

        assertThat(put(LESSONS + lesson + "/summary", "{\"summary\":\"Рано\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyText().contains("schedule.lesson-not-started");
    }

    @Test
    void aMissedIndividualLessonHasNoSummaryButAMissedGroupLessonKeepsIt() throws UnsupportedEncodingException {
        UUID anna = directory.addStudent("Анна");
        String missed = id(post("/api/teacher/schedule/lessons", lesson(anna, Slots.past(clock), 60, true)));
        put(LESSONS + missed + "/outcome", "{\"outcome\":\"MISSED\"}");

        assertThat(put(LESSONS + missed + "/summary", "{\"summary\":\"Нет\"}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT).bodyText().contains("schedule.lesson-missed");

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

    private static String groupLesson(UUID group, Instant start) {
        return """
                {"groupId":"%s","startsAt":"%s","durationMinutes":60,"allowOverlap":true}
                """.formatted(group, start);
    }
}

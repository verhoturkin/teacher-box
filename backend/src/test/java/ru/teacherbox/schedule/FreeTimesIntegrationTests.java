package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;
import static ru.teacherbox.schedule.LessonsIntegrationTests.lesson;

import java.io.UnsupportedEncodingException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.schedule.application.LessonRules;
import ru.teacherbox.schedule.application.LessonRulesService;
import ru.teacherbox.shared.time.InstanceTimeZone;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Free start times of a day for moving a lesson: for its student and for the teacher. */
@ScheduleIntegrationTest
class FreeTimesIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @Autowired
    InstanceTimeZone timeZone;

    @Autowired
    LessonRulesService rules;

    @Autowired
    TestLessonRules testRules;

    @AfterEach
    void backToTheTestRules() {
        testRules.restore();
    }

    @Test
    void freeTimesStayInTheWorkingHours() throws UnsupportedEncodingException {
        LessonRules test = TestLessonRules.RULES;
        rules.change(new LessonRules(test.defaultDurationMinutes(), test.lateCancellation(), test.reminders(),
                test.horizon(), LocalTime.of(10, 0), LocalTime.of(13, 0)));
        UUID student = directory.addStudent("Рабочее время");
        LocalDate day = LocalDate.ofInstant(clock.instant(), zone()).plusDays(3 * 365 + 42);
        String own = plan(student, at(day, 18, 0));

        assertThat(mvc.get().uri("/api/teacher/schedule/free-times?date={date}&lessonId={id}", day, own)
                .with(teacher())).hasStatusOk().bodyJson().extractingPath("$").asArray()
                .startsWith(at(day, 10, 0).toString()).endsWith(at(day, 12, 0).toString())
                .doesNotContain(at(day, 9, 45).toString(), at(day, 12, 15).toString(), at(day, 18, 0).toString());
    }

    @Test
    void freeTimesLeaveOutOtherLessonsButNotTheMovedOne() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Ищет время");
        // Far ahead of every other test's lessons, at hours of the teacher's zone.
        LocalDate day = LocalDate.ofInstant(clock.instant(), zone()).plusDays(3 * 365 + 40);
        String own = plan(student, at(day, 12, 0));
        plan(directory.addStudent("Другой"), at(day, 14, 0));
        String uri = "?date={date}&lessonId={id}";

        for (MvcTestResult result : new MvcTestResult[] {
                mvc.get().uri("/api/me/schedule/free-times" + uri, day, own).with(TestUsers.student(student))
                        .exchange(),
                mvc.get().uri("/api/teacher/schedule/free-times" + uri, day, own).with(teacher()).exchange() }) {
            assertThat(result).hasStatusOk().bodyJson().extractingPath("$").asArray()
                    .contains(at(day, 12, 0).toString(), at(day, 12, 30).toString(), at(day, 13, 0).toString(),
                            at(day, 15, 0).toString())
                    .doesNotContain(at(day, 13, 15).toString(), at(day, 14, 0).toString(),
                            at(day, 14, 45).toString());
        }
    }

    @Test
    void onlyTheLessonsStudentAndTheTeacherAsk() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Свой урок");
        LocalDate day = LocalDate.ofInstant(clock.instant(), zone()).plusDays(3 * 365 + 41);
        String own = plan(student, at(day, 12, 0));

        assertThat(mvc.get().uri("/api/me/schedule/free-times?date={date}&lessonId={id}", day, own)
                .with(TestUsers.student(directory.addStudent("Чужой")))).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/me/schedule/free-times?date={date}&lessonId={id}", day, own)
                .with(teacher())).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/schedule/free-times?date={date}&lessonId={id}", day, own)
                .with(TestUsers.student(student))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/schedule/free-times?date={date}&lessonId={id}", day,
                UUID.randomUUID()).with(teacher())).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void aPastDayHasNoFreeTimes() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Вчера");
        String own = plan(student, Slots.next(clock));
        LocalDate yesterday = LocalDate.ofInstant(clock.instant(), zone()).minusDays(1);

        assertThat(mvc.get().uri("/api/teacher/schedule/free-times?date={date}&lessonId={id}", yesterday, own)
                .with(teacher())).hasStatusOk().bodyJson().extractingPath("$").asArray().isEmpty();
    }

    private ZoneId zone() {
        return timeZone.zoneId();
    }

    private Instant at(LocalDate day, int hour, int minute) {
        return day.atTime(LocalTime.of(hour, minute)).atZone(zone()).toInstant();
    }

    private String plan(UUID student, Instant start) throws UnsupportedEncodingException {
        return id(mvc.post().uri("/api/teacher/schedule/lessons").with(teacher())
                .contentType(MediaType.APPLICATION_JSON).content(lesson(student, start, 60, true)).exchange());
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }
}

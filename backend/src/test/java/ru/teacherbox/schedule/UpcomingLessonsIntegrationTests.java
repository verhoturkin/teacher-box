package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** The lessons ahead on a student's card: a series is one item, one-off lessons and exceptions their own. */
@ScheduleIntegrationTest
class UpcomingLessonsIntegrationTests extends ScheduleHttpTestSupport {

    private static final ZoneId ZONE = ZoneId.of("Europe/Moscow");
    private static final String LESSONS = "/api/teacher/schedule/lessons";

    @Autowired
    MutableClock clock;

    @Autowired
    FakeStudentGroups groups;

    @Test
    void aWeeklySeriesOnTwoDaysIsOneItem() throws Exception {
        UUID anna = directory.addStudent("Анна");
        LocalDate tuesday = nextWeek(DayOfWeek.TUESDAY);
        post(LESSONS, repeat(anna, at(tuesday, 15), null)).assertThat().hasStatus(HttpStatus.CREATED);
        post(LESSONS, repeat(anna, at(tuesday.plusDays(2), 15), null)).assertThat().hasStatus(HttpStatus.CREATED);

        assertThat(upcoming("students", anna)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.series.length()").isEqualTo(1);
            assertThat(json).extractingPath("$.series[0].weekdays").asArray().containsExactly("TUESDAY", "THURSDAY");
            assertThat(json).extractingPath("$.series[0].startTime").isEqualTo("15:00:00");
            assertThat(json).extractingPath("$.series[0].durationMinutes").isEqualTo(60);
            assertThat(json).extractingPath("$.series[0].title").isEqualTo("Английский");
            assertThat(json).extractingPath("$.series[0].endsOn").isNull();
            assertThat(json).extractingPath("$.series[0].remaining").isNull();
            assertThat(json).extractingPath("$.series[0].since").isEqualTo(tuesday.toString());
            assertThat(json).extractingPath("$.series[0].nextStartsAt").isEqualTo(at(tuesday, 15).toString());
            assertThat(json).extractingPath("$.lessons.length()").isEqualTo(0);
        });
    }

    @Test
    void aSeriesWithAnEndCountsTheLessonsLeft() throws Exception {
        UUID boris = directory.addStudent("Борис");
        LocalDate monday = nextWeek(DayOfWeek.MONDAY);
        post(LESSONS, repeat(boris, at(monday, 10), monday.plusWeeks(3))).assertThat().hasStatus(HttpStatus.CREATED);

        assertThat(upcoming("students", boris)).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.series[0].endsOn").isEqualTo(monday.plusWeeks(3).toString());
            assertThat(json).extractingPath("$.series[0].remaining").isEqualTo(4);
        });
    }

    @Test
    void movedAndCancelledOccurrencesAndOneOffLessonsAreOwnItems() throws Exception {
        UUID vera = directory.addStudent("Вера");
        LocalDate wednesday = nextWeek(DayOfWeek.WEDNESDAY);
        String first = id(post(LESSONS, repeat(vera, at(wednesday, 12), wednesday.plusWeeks(4))));
        List<Map<String, Object>> dates = JsonPath.read(get(LESSONS + "?from=" + wednesday + "&to="
                + wednesday.plusWeeks(5) + "&studentId=" + vera).getResponse().getContentAsString(), "$");
        String second = dates.get(1).get("id").toString();
        put(LESSONS + "/" + first, """
                {"startsAt":"%s","durationMinutes":60,"repeatWeeks":1,"repeatUntil":"%s","scope":"ONLY",
                 "title":"Английский","allowOverlap":true}""".formatted(at(wednesday.plusDays(1), 12),
                wednesday.plusWeeks(4))).assertThat().hasStatusOk();
        post(LESSONS + "/" + second + "/cancel", "{\"scope\":\"ONLY\"}").assertThat().hasStatusOk();
        String single = id(post(LESSONS, """
                {"studentId":"%s","startsAt":"%s","durationMinutes":45,"allowOverlap":true}"""
                .formatted(vera, at(wednesday.plusDays(2), 18))));

        assertThat(upcoming("students", vera)).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.series[0].remaining").isEqualTo(3);
            assertThat(json).extractingPath("$.lessons.length()").isEqualTo(3);
            assertThat(json).extractingPath("$.lessons[0].kind").isEqualTo("MOVED");
            assertThat(json).extractingPath("$.lessons[0].lesson.id").isEqualTo(first);
            assertThat(json).extractingPath("$.lessons[1].kind").isEqualTo("ONE_OFF");
            assertThat(json).extractingPath("$.lessons[1].lesson.id").isEqualTo(single);
            assertThat(json).extractingPath("$.lessons[2].kind").isEqualTo("CANCELLED");
            assertThat(json).extractingPath("$.lessons[2].lesson.id").isEqualTo(second);
        });
    }

    @Test
    void groupLessonsAreInTheStudentsAndTheGroupsItems() throws Exception {
        UUID gleb = directory.addStudent("Глеб");
        UUID group = groups.addGroup("ОГЭ", gleb);
        LocalDate friday = nextWeek(DayOfWeek.FRIDAY);
        post(LESSONS, """
                {"groupId":"%s","startsAt":"%s","durationMinutes":90,"repeatWeeks":2,"allowOverlap":true}"""
                .formatted(group, at(friday, 17))).assertThat().hasStatus(HttpStatus.CREATED);

        assertThat(upcoming("students", gleb)).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.series[0].groupName").isEqualTo("ОГЭ");
            assertThat(json).extractingPath("$.series[0].intervalWeeks").isEqualTo(2);
        });
        assertThat(upcoming("groups", group)).bodyJson().extractingPath("$.series[0].weekdays")
                .asArray().containsExactly("FRIDAY");
    }

    @Test
    void onlyTheTeacherReadsThem() {
        UUID student = directory.addStudent("Дина");
        assertThat(mvc.get().uri("/api/teacher/schedule/students/{id}/upcoming", student)
                .with(TestUsers.student(student)).exchange()).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/schedule/groups/{id}/upcoming", UUID.randomUUID())
                .with(TestUsers.student(student)).exchange()).hasStatus(HttpStatus.FORBIDDEN);
    }

    private MvcTestResult upcoming(String of, UUID id) {
        return get("/api/teacher/schedule/" + of + "/" + id + "/upcoming");
    }

    private LocalDate nextWeek(DayOfWeek day) {
        return LocalDate.ofInstant(clock.instant(), ZONE).plusWeeks(1).with(TemporalAdjusters.nextOrSame(day));
    }

    private static Instant at(LocalDate date, int hour) {
        return date.atTime(LocalTime.of(hour, 0)).atZone(ZONE).toInstant();
    }

    private static String repeat(UUID student, Instant start, LocalDate until) {
        return """
                {"studentId":"%s","startsAt":"%s","durationMinutes":60,"repeatWeeks":1,%s"title":"Английский",
                 "allowOverlap":true}""".formatted(student, start,
                until == null ? "" : "\"repeatUntil\":\"" + until + "\",");
    }

    private static String id(MvcTestResult result) throws Exception {
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(result.getResponse().getContentAsString(), "$.id");
    }
}

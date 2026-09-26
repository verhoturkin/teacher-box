package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;
import static ru.teacherbox.schedule.LessonsIntegrationTests.lesson;

import com.jayway.jsonpath.JsonPath;
import java.io.UnsupportedEncodingException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.schedule.api.SeriesScheduled;
import ru.teacherbox.schedule.api.SeriesStopped;
import ru.teacherbox.schedule.application.ScheduleService;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/**
 * Regular lessons. Every test uses its own time of day in days two weeks ahead, where single
 * lessons of the other tests do not go (horizon: 28 days).
 */
@ScheduleIntegrationTest
class SeriesIntegrationTests {

    private static final ZoneId MOSCOW = ZoneId.of("Europe/Moscow");

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @Autowired
    ScheduleService schedule;

    @Test
    void createsTheLessonsOfTheHorizon(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Регулярный");
        LocalDate first = today().plusDays(14);

        MvcTestResult result = post("/api/teacher/schedule/series",
                series(student, first, "07:00", true, "\"topic\":\"Английский\""));

        assertThat(result).hasStatus(HttpStatus.CREATED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.lessons").isEqualTo(3);
            assertThat(json).extractingPath("$.series.studentName").isEqualTo("Регулярный");
            assertThat(json).extractingPath("$.series.weekdays").asArray().containsExactly(first.getDayOfWeek().name());
            assertThat(json).extractingPath("$.series.startTime").isEqualTo("07:00:00");
        });
        String seriesId = JsonPath.read(result.getResponse().getContentAsString(), "$.series.id");
        assertThat(lessonsOf(seriesId, first)).containsExactly(at(first, "07:00"), at(first.plusDays(7), "07:00"),
                at(first.plusDays(14), "07:00"));
        assertThat(events).contains(SeriesScheduled.class)
                .matching(event -> event.seriesId().toString(), seriesId)
                .matching(SeriesScheduled::startTime, LocalTime.of(7, 0));
        assertThat(mvc.get().uri("/api/teacher/schedule/series").with(teacher()))
                .hasStatusOk()
                .bodyJson().extractingPath("$[*].id").asArray().contains(seriesId);
    }

    @Test
    void rejectsOverlapsUnlessAllowed() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Занятой");
        UUID other = directory.addStudent("Другой");
        LocalDate day = today().plusDays(15);
        id(post("/api/teacher/schedule/lessons", lesson(other, at(day, "13:00"), 60, true)));

        assertThat(post("/api/teacher/schedule/series", series(student, day, "13:30", false, null)))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.overlap");
        assertThat(post("/api/teacher/schedule/series", series(student, day, "13:30", true, null)))
                .hasStatus(HttpStatus.CREATED);
    }

    @Test
    void changesFromADayAndKeepsIndividuallyMovedLessons(AssertablePublishedEvents events)
            throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Меняет время");
        LocalDate first = today().plusDays(14);
        String seriesId = JsonPath.read(post("/api/teacher/schedule/series", series(student, first, "15:00", true,
                null)).getResponse().getContentAsString(), "$.series.id");
        String lastLesson = mvc.get().uri("/api/teacher/schedule/lessons?from={from}&to={to}", first.plusDays(14),
                first.plusDays(15)).with(teacher()).exchange().getResponse().getContentAsString();
        String movedId = JsonPath.<List<String>>read(lastLesson,
                "$[?(@.seriesId == '" + seriesId + "')].id").getFirst();
        assertThat(put("/api/teacher/schedule/lessons/" + movedId, """
                {"startsAt":"%s","durationMinutes":60,"allowOverlap":true}
                """.formatted(at(first.plusDays(14), "20:30")))).hasStatusOk();

        MvcTestResult changed = put("/api/teacher/schedule/series/" + seriesId,
                series(student, first.plusDays(7), "16:30", true, null));

        assertThat(changed).hasStatusOk().bodyJson().extractingPath("$.lessons").isEqualTo(2);
        String newSeriesId = JsonPath.read(changed.getResponse().getContentAsString(), "$.series.id");
        assertThat(lessonsOf(seriesId, first)).as("the first lesson and the moved one stay")
                .containsExactly(at(first, "15:00"), at(first.plusDays(14), "20:30"));
        assertThat(lessonsOf(newSeriesId, first)).containsExactly(at(first.plusDays(7), "16:30"),
                at(first.plusDays(14), "16:30"));
        assertThat(events).contains(SeriesStopped.class)
                .matching(event -> event.seriesId().toString(), seriesId)
                .matching(SeriesStopped::replaced, true);
        assertThat(put("/api/teacher/schedule/series/" + newSeriesId,
                series(directory.addStudent("Чужой"), first.plusDays(7), "16:30", true, null)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.series-student-fixed");
    }

    @Test
    void stopsASeries(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Закончил");
        LocalDate first = today().plusDays(14);
        String seriesId = JsonPath.read(post("/api/teacher/schedule/series", series(student, first, "17:00", true,
                null)).getResponse().getContentAsString(), "$.series.id");

        assertThat(post("/api/teacher/schedule/series/" + seriesId + "/stop", "{\"from\":\"%s\"}".formatted(first)))
                .hasStatus(HttpStatus.NO_CONTENT);

        assertThat(lessonsOf(seriesId, first)).isEmpty();
        assertThat(mvc.get().uri("/api/teacher/schedule/series").with(teacher()))
                .hasStatusOk()
                .bodyJson().extractingPath("$[*].id").asArray().doesNotContain(seriesId);
        assertThat(events).contains(SeriesStopped.class)
                .matching(event -> event.seriesId().toString(), seriesId)
                .matching(SeriesStopped::replaced, false);
        assertThat(post("/api/teacher/schedule/series/" + UUID.randomUUID() + "/stop",
                "{\"from\":\"%s\"}".formatted(first))).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void nightlyExtensionAddsTheNextLessons() throws UnsupportedEncodingException {
        UUID student = directory.addStudent("Надолго");
        LocalDate first = today().plusDays(14);
        String seriesId = JsonPath.read(post("/api/teacher/schedule/series", series(student, first, "09:30", true,
                null)).getResponse().getContentAsString(), "$.series.id");

        clock.advance(Duration.ofDays(7));

        assertThat(schedule.extendSeries()).isGreaterThanOrEqualTo(1);
        assertThat(lessonsOf(seriesId, first)).contains(at(first.plusDays(21), "09:30"));
    }

    @Test
    void validatesTheSeries() {
        UUID student = directory.addStudent("Ошибся");
        LocalDate first = today().plusDays(14);

        assertThat(post("/api/teacher/schedule/series", """
                {"studentId":"%s","weekdays":[],"startTime":"10:00","startsOn":"%s"}
                """.formatted(student, first))).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(post("/api/teacher/schedule/series", """
                {"studentId":"%s","weekdays":["MONDAY"],"startTime":"10:00","startsOn":"%s","endsOn":"%s"}
                """.formatted(student, first, first.minusDays(1))))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.series-dates-invalid");
    }

    private List<Instant> lessonsOf(String seriesId, LocalDate from) throws UnsupportedEncodingException {
        String body = mvc.get().uri("/api/teacher/schedule/lessons?from={from}&to={to}", from, from.plusDays(30))
                .with(teacher()).exchange().getResponse().getContentAsString();
        List<String> starts = JsonPath.read(body, "$[?(@.seriesId == '" + seriesId + "')].startsAt");
        return starts.stream().map(Instant::parse).toList();
    }

    private static String series(UUID student, LocalDate startsOn, String time, boolean allowOverlap,
            String extra) {
        return """
                {"studentId":"%s","weekdays":["%s"],"startTime":"%s","startsOn":"%s","allowOverlap":%s%s}
                """.formatted(student, startsOn.getDayOfWeek(), time, startsOn, allowOverlap,
                extra == null ? "" : "," + extra);
    }

    private static Instant at(LocalDate day, String time) {
        return ZonedDateTime.of(day, LocalTime.parse(time), MOSCOW).toInstant();
    }

    private LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), MOSCOW);
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    private MvcTestResult post(String uri, String body) {
        return mvc.post().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private MvcTestResult put(String uri, String body) {
        return mvc.put().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }
}

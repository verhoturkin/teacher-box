package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static ru.teacherbox.schedule.LessonsIntegrationTests.id;
import static ru.teacherbox.schedule.LessonsIntegrationTests.lesson;

import java.io.UnsupportedEncodingException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.util.UriComponentsBuilder;
import ru.teacherbox.schedule.api.GoogleCalendarDisconnected;
import ru.teacherbox.schedule.google.GoogleApi;
import ru.teacherbox.schedule.google.GoogleAuthException;
import ru.teacherbox.schedule.google.GoogleCalendarService;
import ru.teacherbox.schedule.google.GoogleException;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Connecting the teacher's Google Calendar and syncing lessons into it (Google itself is mocked). */
@ScheduleIntegrationTest
class GoogleCalendarIntegrationTests {

    private static final String ORIGIN = "https://school.example.com";
    private static final String CALENDAR = "tb@group.calendar.google.com";

    @MockitoBean
    GoogleApi google;

    @Autowired
    MockMvcTester mvc;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @Autowired
    GoogleCalendarService calendar;

    @BeforeEach
    void startDisconnected() {
        calendar.disconnect();
        clearInvocations(google);
        when(google.authorizationUrl(anyString(), anyString(), any(), anyString()))
                .thenAnswer(call -> "https://accounts.google.com/o/oauth2/v2/auth?state=" + call.getArgument(3));
        when(google.exchangeCode(any(), eq("code-1"), anyString()))
                .thenReturn(new GoogleApi.Tokens("access-1", 3600, "refresh-1"));
        when(google.createCalendar("access-1", "Teacher Box", "Europe/Moscow")).thenReturn(CALENDAR);
    }

    @Test
    void theTeacherEntersTheClientAndConnects() {
        assertThat(get("/api/teacher/schedule/google")).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.status").isEqualTo("NOT_CONNECTED");
            assertThat(json).extractingPath("$.callbackPath").isEqualTo("/api/public/schedule/google/callback");
        });
        assertThat(put("/api/teacher/schedule/google/client", "{\"clientId\":\" id-1 \",\"clientSecret\":\"secret\"}"))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.clientConfigured").isEqualTo(true);
                    assertThat(json).extractingPath("$.clientId").isEqualTo("id-1");
                    assertThat(json).extractingPath("$.clientFromEnvironment").isEqualTo(false);
                });

        String state = authorize(true);
        verify(google).authorizationUrl("id-1", ORIGIN + "/api/public/schedule/google/callback",
                List.of(GoogleApi.CALENDAR_SCOPE, GoogleApi.FREEBUSY_SCOPE), state);

        assertThat(callback("?state=" + state + "&code=code-1")).hasStatus(HttpStatus.FOUND)
                .hasHeader("Location", "/teacher/settings?google=connected");
        verify(google).exchangeCode(new GoogleApi.Client("id-1", "secret"), "code-1",
                ORIGIN + "/api/public/schedule/google/callback");
        assertThat(get("/api/teacher/schedule/google")).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.status").isEqualTo("CONNECTED");
            assertThat(json).extractingPath("$.busyEnabled").isEqualTo(true);
        });
        assertThat(callback("?state=" + state + "&code=code-1"))
                .hasHeader("Location", "/teacher/settings?google=expired");
    }

    @Test
    void unknownDeniedAndFailedAuthorizations() {
        saveClient();
        assertThat(callback("")).hasHeader("Location", "/teacher/settings?google=expired");
        assertThat(callback("?state=" + "x".repeat(43) + "&code=c")).hasHeader("Location",
                "/teacher/settings?google=expired");
        assertThat(callback("?state=" + authorize(false) + "&error=access_denied"))
                .hasHeader("Location", "/teacher/settings?google=denied");

        when(google.exchangeCode(any(), eq("bad"), anyString())).thenThrow(new GoogleException("Google token 400"));
        assertThat(callback("?state=" + authorize(false) + "&code=bad"))
                .hasHeader("Location", "/teacher/settings?google=failed");
        assertThat(get("/api/teacher/schedule/google")).bodyJson().extractingPath("$.lastError")
                .isEqualTo("Google token 400");

        when(google.exchangeCode(any(), eq("no-refresh"), anyString()))
                .thenReturn(new GoogleApi.Tokens("access", 3600, null));
        assertThat(callback("?state=" + authorize(false) + "&code=no-refresh"))
                .hasHeader("Location", "/teacher/settings?google=failed");
    }

    @Test
    void theClientIsRequiredAndTheOriginChecked() {
        calendar.disconnect();
        assertThat(post("/api/teacher/schedule/google/authorize", "{\"origin\":\"ftp://x\",\"busy\":false}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        saveClient();
        assertThat(post("/api/teacher/schedule/google/authorize", "{\"origin\":\"ftp://x\",\"busy\":false}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("schedule.google-origin-invalid");
        assertThat(post("/api/teacher/schedule/google/authorize",
                "{\"origin\":\"https://user@evil.example\",\"busy\":false}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(put("/api/teacher/schedule/google/client", "{\"clientId\":\" \",\"clientSecret\":\"s\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(mvc.get().uri("/api/teacher/schedule/google").with(TestUsers.student(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void syncsLessonsIntoTheCalendar() throws UnsupportedEncodingException {
        connect();
        UUID student = directory.addStudent("Вера");
        Instant start = Slots.next(clock);
        String lessonId = id(post("/api/teacher/schedule/lessons", lesson(student, start, 60, true)));
        String eventId = lessonId.replace("-", "");

        calendar.sync();
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> event = ArgumentCaptor.forClass(Map.class);
        verify(google).putEvent(eq("access-1"), eq(CALENDAR), eq(eventId), event.capture());
        assertThat(event.getValue()).containsEntry("summary", "Урок: Вера")
                .containsEntry("start", Map.of("dateTime", start.toString(), "timeZone", "Europe/Moscow"));

        clearInvocations(google);
        calendar.sync();
        verify(google, never()).putEvent(any(), any(), eq(eventId), anyMap());

        assertThat(post("/api/teacher/schedule/lessons/" + lessonId + "/cancel", "{}")).hasStatusOk();
        assertThat(post("/api/teacher/schedule/google/sync", "")).hasStatusOk()
                .bodyJson().extractingPath("$.changed").isEqualTo(1);
        verify(google).deleteEvent("access-1", CALENDAR, eventId);
        assertThat(get("/api/teacher/schedule/google")).bodyJson().extractingPath("$.lastSyncAt").isNotNull();
    }

    @Test
    void removesEventsOfDeletedLessons() throws UnsupportedEncodingException {
        connect();
        UUID student = directory.addStudent("Серия");
        String body = post("/api/teacher/schedule/series", """
                {"studentId":"%s","weekdays":["%s"],"startTime":"06:15","startsOn":"%s","allowOverlap":true}
                """.formatted(student, java.time.LocalDate.now(clock).plusDays(3).getDayOfWeek(),
                java.time.LocalDate.now(clock).plusDays(3))).getResponse().getContentAsString();
        String seriesId = com.jayway.jsonpath.JsonPath.read(body, "$.series.id");
        calendar.sync();
        clearInvocations(google);

        assertThat(post("/api/teacher/schedule/series/" + seriesId + "/stop",
                "{\"from\":\"%s\"}".formatted(java.time.LocalDate.now(clock)))).hasStatus(HttpStatus.NO_CONTENT);
        calendar.sync();

        verify(google, times(4)).deleteEvent(eq("access-1"), eq(CALENDAR), anyString());
    }

    @Test
    void lostAccessAsksToConnectAgain(AssertablePublishedEvents events) throws UnsupportedEncodingException {
        connect();
        calendar.disconnect();
        connect();
        clock.advance(java.time.Duration.ofHours(2));
        when(google.refresh(any(), eq("refresh-1"))).thenThrow(new GoogleAuthException("invalid_grant"));
        id(post("/api/teacher/schedule/lessons", lesson(directory.addStudent("Без доступа"), Slots.next(clock), 60, true)));

        assertThat(calendar.sync()).isZero();

        assertThat(get("/api/teacher/schedule/google")).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.status").isEqualTo("NEEDS_RECONNECT");
            assertThat(json).extractingPath("$.lastError").isEqualTo("invalid_grant");
        });
        assertThat(events).contains(GoogleCalendarDisconnected.class);
        assertThat(calendar.sync()).as("nothing to do until connected again").isZero();
    }

    @Test
    void otherSyncErrorsAreShownAndRetried() throws UnsupportedEncodingException {
        connect();
        id(post("/api/teacher/schedule/lessons", lesson(directory.addStudent("Квота"), Slots.next(clock), 60, true)));
        doThrow(new GoogleException("Google update event 429: Rate Limit Exceeded"))
                .when(google).putEvent(any(), any(), any(), anyMap());

        calendar.sync();

        assertThat(get("/api/teacher/schedule/google")).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.status").isEqualTo("CONNECTED");
            assertThat(json).extractingPath("$.lastError").isEqualTo("Google update event 429: Rate Limit Exceeded");
        });
    }

    @Test
    void reconnectingReusesTheCalendar() {
        connect();
        when(google.calendarExists("access-1", CALENDAR)).thenReturn(true);
        clearInvocations(google);

        connect();

        verify(google, never()).createCalendar(any(), any(), any());
    }

    @Test
    void readsBusyTimesWhenAllowed() {
        Instant from = Instant.parse("2026-10-01T00:00:00Z");
        Instant to = Instant.parse("2026-10-08T00:00:00Z");
        assertThat(busy(from, to)).bodyJson().extractingPath("$").asArray().isEmpty();

        connect();
        when(google.busy("access-1", from, to)).thenReturn(List.of(new GoogleApi.Busy(from, from.plusSeconds(3600))));
        assertThat(busy(from, to)).hasStatusOk()
                .bodyJson().extractingPath("$[0].end").isEqualTo("2026-10-01T01:00:00Z");
        assertThat(busy(to, from)).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(busy(from, from.plus(java.time.Duration.ofDays(63)))).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);

        when(google.busy("access-1", from, to)).thenThrow(new GoogleAuthException("revoked"));
        assertThat(busy(from, to)).bodyJson().extractingPath("$").asArray().isEmpty();
    }

    @Test
    void disconnectingRevokesTheToken() {
        connect();
        doThrow(new GoogleException("offline")).when(google).revoke("refresh-1");

        assertThat(mvc.delete().uri("/api/teacher/schedule/google").with(teacher())).hasStatus(HttpStatus.NO_CONTENT);

        verify(google).revoke("refresh-1");
        assertThat(get("/api/teacher/schedule/google")).bodyJson().extractingPath("$.status")
                .isEqualTo("NOT_CONNECTED");
    }

    private void connect() {
        saveClient();
        assertThat(callback("?state=" + authorize(true) + "&code=code-1"))
                .hasHeader("Location", "/teacher/settings?google=connected");
    }

    private void saveClient() {
        assertThat(put("/api/teacher/schedule/google/client", "{\"clientId\":\"id-1\",\"clientSecret\":\"secret\"}"))
                .hasStatusOk();
    }

    /** @return the state parameter of the consent address */
    private String authorize(boolean busy) {
        MvcTestResult result = post("/api/teacher/schedule/google/authorize",
                "{\"origin\":\"%s/\",\"busy\":%s}".formatted(ORIGIN, busy));
        assertThat(result).hasStatusOk();
        try {
            String url = com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.url");
            return UriComponentsBuilder.fromUriString(url).build().getQueryParams().getFirst("state");
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }

    private MvcTestResult callback(String query) {
        return mvc.get().uri("/api/public/schedule/google/callback" + query).exchange();
    }

    private MvcTestResult busy(Instant from, Instant to) {
        return mvc.get().uri("/api/teacher/schedule/google/busy?from={from}&to={to}", from, to).with(teacher())
                .exchange();
    }

    private RequestPostProcessor teacher() {
        return TestUsers.teacher(directory.teacherId());
    }

    private MvcTestResult get(String uri) {
        return mvc.get().uri(uri).with(teacher()).exchange();
    }

    private MvcTestResult post(String uri, String body) {
        return mvc.post().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }

    private MvcTestResult put(String uri, String body) {
        return mvc.put().uri(uri).with(teacher()).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }
}

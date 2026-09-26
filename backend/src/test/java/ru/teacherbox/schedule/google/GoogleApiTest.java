package ru.teacherbox.schedule.google;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/** Google OAuth and Calendar API calls against a mock server. */
class GoogleApiTest {

    private static final String OAUTH = "https://oauth2.googleapis.com";
    private static final String CALENDAR = "https://www.googleapis.com/calendar/v3";
    private static final GoogleApi.Client CLIENT = new GoogleApi.Client("client-id", "client-secret");

    private final RestClient.Builder oauthBuilder = RestClient.builder().baseUrl(OAUTH);
    private final RestClient.Builder calendarBuilder = RestClient.builder().baseUrl(CALENDAR);
    private final MockRestServiceServer oauth = MockRestServiceServer.bindTo(oauthBuilder).build();
    private final MockRestServiceServer calendar = MockRestServiceServer.bindTo(calendarBuilder).build();
    private final GoogleApi api = new GoogleApi(oauthBuilder.build(), calendarBuilder.build(),
            "https://accounts.google.com/o/oauth2/v2/auth");

    @Test
    void buildsTheConsentAddress() {
        String url = api.authorizationUrl("client-id", "https://school.example.com/api/public/schedule/google/callback",
                List.of(GoogleApi.CALENDAR_SCOPE, GoogleApi.FREEBUSY_SCOPE), "state-1");

        var params = UriComponentsBuilder.fromUriString(url).build(true).getQueryParams();
        assertThat(url).startsWith("https://accounts.google.com/o/oauth2/v2/auth?");
        assertThat(params.getFirst("client_id")).isEqualTo("client-id");
        assertThat(params.getFirst("redirect_uri"))
                .isEqualTo("https%3A%2F%2Fschool.example.com%2Fapi%2Fpublic%2Fschedule%2Fgoogle%2Fcallback");
        assertThat(params.getFirst("scope")).isEqualTo(
                "https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.app.created%20"
                        + "https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.freebusy");
        assertThat(params.getFirst("access_type")).isEqualTo("offline");
        assertThat(params.getFirst("prompt")).isEqualTo("consent");
        assertThat(params.getFirst("response_type")).isEqualTo("code");
        assertThat(params.getFirst("state")).isEqualTo("state-1");
    }

    @Test
    void exchangesTheCodeAndRefreshesTokens() {
        oauth.expect(requestTo(OAUTH + "/token"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_FORM_URLENCODED))
                .andExpect(content().formDataContains(Map.of("code", "code-1", "grant_type", "authorization_code",
                        "redirect_uri", "https://school/cb", "client_id", "client-id", "client_secret", "client-secret")))
                .andRespond(withSuccess("""
                        {"access_token": "access-1", "expires_in": 3599, "refresh_token": "refresh-1",
                         "token_type": "Bearer"}
                        """, MediaType.APPLICATION_JSON));
        oauth.expect(requestTo(OAUTH + "/token"))
                .andExpect(content().formDataContains(Map.of("grant_type", "refresh_token",
                        "refresh_token", "refresh-1")))
                .andRespond(withSuccess("{\"access_token\": \"access-2\"}", MediaType.APPLICATION_JSON));

        assertThat(api.exchangeCode(CLIENT, "code-1", "https://school/cb"))
                .isEqualTo(new GoogleApi.Tokens("access-1", 3599, "refresh-1"));
        assertThat(api.refresh(CLIENT, "refresh-1")).isEqualTo(new GoogleApi.Tokens("access-2", 3600, null));
        oauth.verify();
    }

    @Test
    void revokedAuthorizationNeedsANewConsent() {
        oauth.expect(requestTo(OAUTH + "/token")).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"error\": \"invalid_grant\", \"error_description\": \"Token has been expired or revoked.\"}"));
        oauth.expect(requestTo(OAUTH + "/token")).andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                .contentType(MediaType.APPLICATION_JSON).body("{\"error\": \"invalid_client\"}"));
        oauth.expect(requestTo(OAUTH + "/token")).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        oauth.expect(requestTo(OAUTH + "/token")).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        oauth.expect(requestTo(OAUTH + "/token")).andRespond(request -> {
            throw new IOException("Connection refused");
        });

        assertThatThrownBy(() -> api.refresh(CLIENT, "old")).isInstanceOf(GoogleAuthException.class)
                .hasMessageContaining("invalid_grant (Token has been expired or revoked.)");
        assertThatThrownBy(() -> api.refresh(CLIENT, "old")).isInstanceOf(GoogleAuthException.class)
                .hasMessageContaining("401: invalid_client");
        assertThatThrownBy(() -> api.refresh(CLIENT, "old")).isInstanceOf(GoogleException.class)
                .hasMessage("Google did not return an access token");
        assertThatThrownBy(() -> api.refresh(CLIENT, "old")).isNotInstanceOf(GoogleAuthException.class)
                .hasMessageContaining("503");
        assertThatThrownBy(() -> api.refresh(CLIENT, "old")).isInstanceOf(GoogleException.class)
                .hasMessageContaining("Connection refused");
    }

    @Test
    void revokesAccess() {
        oauth.expect(requestTo(OAUTH + "/revoke"))
                .andExpect(content().formDataContains(Map.of("token", "refresh-1")))
                .andRespond(withSuccess());
        oauth.expect(requestTo(OAUTH + "/revoke")).andRespond(withStatus(HttpStatus.BAD_REQUEST));
        oauth.expect(requestTo(OAUTH + "/revoke")).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        oauth.expect(requestTo(OAUTH + "/revoke")).andRespond(request -> {
            throw new IOException("timeout");
        });

        api.revoke("refresh-1");
        api.revoke("already-invalid");
        assertThatThrownBy(() -> api.revoke("x")).hasMessageContaining("500");
        assertThatThrownBy(() -> api.revoke("x")).hasMessageContaining("timeout");
    }

    @Test
    void createsAndFindsTheCalendar() {
        calendar.expect(requestTo(CALENDAR + "/calendars"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer access"))
                .andExpect(jsonPath("$.summary").value("Teacher Box"))
                .andExpect(jsonPath("$.timeZone").value("Europe/Moscow"))
                .andRespond(withSuccess("{\"id\": \"abc@group.calendar.google.com\"}", MediaType.APPLICATION_JSON));
        calendar.expect(requestTo(CALENDAR + "/calendars/abc%40group.calendar.google.com")).andRespond(withSuccess());
        calendar.expect(requestTo(CALENDAR + "/calendars/gone")).andRespond(withStatus(HttpStatus.NOT_FOUND));
        calendar.expect(requestTo(CALENDAR + "/calendars/broken")).andRespond(withStatus(HttpStatus.FORBIDDEN)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"error\": {\"code\": 403, \"message\": \"Insufficient Permission\"}}"));
        calendar.expect(requestTo(CALENDAR + "/calendars")).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        assertThat(api.createCalendar("access", "Teacher Box", "Europe/Moscow"))
                .isEqualTo("abc@group.calendar.google.com");
        assertThat(api.calendarExists("access", "abc@group.calendar.google.com")).isTrue();
        assertThat(api.calendarExists("access", "gone")).isFalse();
        assertThatThrownBy(() -> api.calendarExists("access", "broken"))
                .hasMessage("Google get calendar 403: Insufficient Permission");
        assertThatThrownBy(() -> api.createCalendar("access", "Teacher Box", "Europe/Moscow"))
                .hasMessage("Google did not return the id of the new calendar");
    }

    @Test
    void replacesOrInsertsEvents() {
        String events = CALENDAR + "/calendars/cal/events";
        calendar.expect(requestTo(events + "/lesson1")).andExpect(method(HttpMethod.PUT))
                .andExpect(jsonPath("$.summary").value("Урок"))
                .andRespond(withSuccess());
        calendar.expect(requestTo(events + "/lesson2")).andExpect(method(HttpMethod.PUT))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));
        calendar.expect(requestTo(events)).andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.id").value("lesson2"))
                .andRespond(withSuccess());
        calendar.expect(requestTo(events + "/lesson3")).andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        api.putEvent("access", "cal", "lesson1", Map.of("summary", "Урок"));
        api.putEvent("access", "cal", "lesson2", Map.of("summary", "Урок"));
        assertThatThrownBy(() -> api.putEvent("access", "cal", "lesson3", Map.of()))
                .isInstanceOf(GoogleAuthException.class);
        calendar.verify();
    }

    @Test
    void deletesEvents() {
        String events = CALENDAR + "/calendars/cal/events";
        calendar.expect(requestTo(events + "/lesson1")).andExpect(method(HttpMethod.DELETE)).andRespond(withSuccess());
        calendar.expect(requestTo(events + "/lesson2")).andRespond(withStatus(HttpStatus.GONE));
        calendar.expect(requestTo(events + "/lesson3")).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        calendar.expect(requestTo(events + "/lesson4")).andRespond(request -> {
            throw new IOException("reset");
        });

        api.deleteEvent("access", "cal", "lesson1");
        api.deleteEvent("access", "cal", "lesson2");
        assertThatThrownBy(() -> api.deleteEvent("access", "cal", "lesson3")).hasMessageContaining("429");
        assertThatThrownBy(() -> api.deleteEvent("access", "cal", "lesson4")).hasMessageContaining("reset");
    }

    @Test
    void readsBusyTimes() {
        calendar.expect(requestTo(CALENDAR + "/freeBusy"))
                .andExpect(jsonPath("$.timeMin").value("2026-10-01T00:00:00Z"))
                .andExpect(jsonPath("$.items[0].id").value("primary"))
                .andRespond(withSuccess("""
                        {"calendars": {"primary": {"busy": [
                          {"start": "2026-10-01T09:00:00Z", "end": "2026-10-01T10:00:00Z"}]}}}
                        """, MediaType.APPLICATION_JSON));
        calendar.expect(requestTo(CALENDAR + "/freeBusy")).andRespond(request -> {
            throw new IOException("unreachable");
        });

        assertThat(api.busy("access", Instant.parse("2026-10-01T00:00:00Z"), Instant.parse("2026-10-02T00:00:00Z")))
                .containsExactly(new GoogleApi.Busy(Instant.parse("2026-10-01T09:00:00Z"),
                        Instant.parse("2026-10-01T10:00:00Z")));
        assertThatThrownBy(() -> api.busy("access", Instant.EPOCH, Instant.EPOCH))
                .hasMessageStartingWith("Google free/busy:").hasMessageContaining("unreachable");
    }
}

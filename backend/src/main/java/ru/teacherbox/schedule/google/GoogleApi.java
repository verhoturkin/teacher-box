package ru.teacherbox.schedule.google;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import ru.teacherbox.shared.http.GoogleOAuth.Client;
import ru.teacherbox.shared.http.GoogleOAuth.Tokens;
import ru.teacherbox.shared.http.GoogleOAuth;
import tools.jackson.databind.JsonNode;

/**
 * Google OAuth 2.0 (authorization code flow for web server applications) and the few Calendar API
 * calls the portal needs: a calendar of its own, events in it and free/busy times.
 */
public class GoogleApi {

    /** Scope that lets the app create calendars and manage events only in them. */
    public static final String CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
    /** Scope for the busy times of the teacher's own calendars. */
    public static final String FREEBUSY_SCOPE = "https://www.googleapis.com/auth/calendar.freebusy";

    /** A time when the teacher is busy in their own calendars. */
    public record Busy(Instant start, Instant end) {
    }

    private final GoogleOAuth oauth;
    private final RestClient calendar;

    /**
     * @param oauth    client with the base address of the token and revoke endpoints
     * @param calendar client with the base address of the Calendar API
     */
    public GoogleApi(RestClient oauth, RestClient calendar, String authorizationUrl) {
        this.oauth = new GoogleOAuth(oauth, authorizationUrl, GoogleException::new, GoogleAuthException::new);
        this.calendar = calendar;
    }

    /** The consent page; {@code prompt=consent} makes Google return a refresh token every time. */
    public String authorizationUrl(String clientId, String redirectUri, List<String> scopes, String state) {
        return oauth.authorizationUrl(clientId, redirectUri, String.join(" ", scopes), state);
    }

    public Tokens exchangeCode(Client client, String code, String redirectUri) {
        return oauth.exchangeCode(client, code, redirectUri);
    }

    /** @throws GoogleAuthException if the refresh token is revoked or expired */
    public Tokens refresh(Client client, String refreshToken) {
        return oauth.refresh(client, refreshToken);
    }

    /** Withdraws the app's access; a token that is already invalid is fine. */
    public void revoke(String token) {
        oauth.revoke(token);
    }

    /** @return id of the new calendar */
    public String createCalendar(String accessToken, String summary, String timeZone) {
        JsonNode created = oauth.call("create calendar", () -> calendar.post()
                .uri("/calendars")
                .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("summary", summary, "timeZone", timeZone))
                .retrieve()
                .body(JsonNode.class));
        String id = created == null ? "" : created.path("id").asString("");
        if (id.isEmpty()) {
            throw new GoogleException("Google did not return the id of the new calendar");
        }
        return id;
    }

    public boolean calendarExists(String accessToken, String calendarId) {
        try {
            calendar.get()
                    .uri("/calendars/{id}", calendarId)
                    .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RestClientResponseException e) {
            if (isGone(e)) {
                return false;
            }
            throw oauth.failure("get calendar", e);
        } catch (RestClientException e) {
            throw new GoogleException("Google get calendar: " + e.getMessage());
        }
    }

    /** Deletes a calendar of the portal; one that is already gone is fine. */
    public void deleteCalendar(String accessToken, String calendarId) {
        try {
            calendar.delete()
                    .uri("/calendars/{id}", calendarId)
                    .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            if (!isGone(e)) {
                throw oauth.failure("delete calendar", e);
            }
        } catch (RestClientException e) {
            throw new GoogleException("Google delete calendar: " + e.getMessage());
        }
    }

    /** Creates or replaces the event with the given id. */
    public void putEvent(String accessToken, String calendarId, String eventId, Map<String, Object> event) {
        try {
            calendar.put()
                    .uri("/calendars/{calendar}/events/{event}", calendarId, eventId)
                    .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(event)
                    .retrieve()
                    .toBodilessEntity();
            return;
        } catch (RestClientResponseException e) {
            if (!isGone(e)) {
                throw oauth.failure("update event", e);
            }
        } catch (RestClientException e) {
            throw new GoogleException("Google update event: " + e.getMessage());
        }
        Map<String, Object> withId = new LinkedHashMap<>(event);
        withId.put("id", eventId);
        oauth.call("insert event", () -> calendar.post()
                .uri("/calendars/{calendar}/events", calendarId)
                .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                .contentType(MediaType.APPLICATION_JSON)
                .body(withId)
                .retrieve()
                .toBodilessEntity());
    }

    /** Removes the event; an event that is already gone is fine. */
    public void deleteEvent(String accessToken, String calendarId, String eventId) {
        try {
            calendar.delete()
                    .uri("/calendars/{calendar}/events/{event}", calendarId, eventId)
                    .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            if (!isGone(e)) {
                throw oauth.failure("delete event", e);
            }
        } catch (RestClientException e) {
            throw new GoogleException("Google delete event: " + e.getMessage());
        }
    }

    /** Busy times of the teacher's primary calendar in {@code [from, to)}. */
    public List<Busy> busy(String accessToken, Instant from, Instant to) {
        JsonNode response = oauth.call("free/busy", () -> calendar.post()
                .uri("/freeBusy")
                .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("timeMin", from.toString(), "timeMax", to.toString(),
                        "items", List.of(Map.of("id", "primary"))))
                .retrieve()
                .body(JsonNode.class));
        List<Busy> busy = new ArrayList<>();
        if (response != null) {
            for (JsonNode period : response.path("calendars").path("primary").path("busy")) {
                busy.add(new Busy(Instant.parse(period.path("start").asString()),
                        Instant.parse(period.path("end").asString())));
            }
        }
        return busy;
    }

    private static boolean isGone(RestClientResponseException e) {
        int status = e.getStatusCode().value();
        return status == HttpStatus.NOT_FOUND.value() || status == HttpStatus.GONE.value();
    }
}

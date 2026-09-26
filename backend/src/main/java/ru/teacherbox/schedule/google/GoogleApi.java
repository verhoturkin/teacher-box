package ru.teacherbox.schedule.google;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;
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

    /** OAuth client of the teacher's Google Cloud project. */
    public record Client(String id, String secret) {
    }

    /**
     * @param refreshToken returned when the user consents (offline access)
     */
    public record Tokens(String accessToken, long expiresInSeconds, @Nullable String refreshToken) {
    }

    /** A time when the teacher is busy in their own calendars. */
    public record Busy(Instant start, Instant end) {
    }

    private final RestClient oauth;
    private final RestClient calendar;
    private final String authorizationUrl;

    /**
     * @param oauth    client with the base address of the token and revoke endpoints
     * @param calendar client with the base address of the Calendar API
     */
    public GoogleApi(RestClient oauth, RestClient calendar, String authorizationUrl) {
        this.oauth = oauth;
        this.calendar = calendar;
        this.authorizationUrl = authorizationUrl;
    }

    /**
     * The consent page; {@code prompt=consent} makes Google return a refresh token every time. The
     * values are passed as URI variables so that they are fully percent-encoded.
     */
    public String authorizationUrl(String clientId, String redirectUri, List<String> scopes, String state) {
        return UriComponentsBuilder.fromUriString(authorizationUrl)
                .queryParam("client_id", "{clientId}")
                .queryParam("redirect_uri", "{redirectUri}")
                .queryParam("response_type", "code")
                .queryParam("scope", "{scope}")
                .queryParam("access_type", "offline")
                .queryParam("prompt", "consent")
                .queryParam("state", "{state}")
                .encode()
                .buildAndExpand(Map.of("clientId", clientId, "redirectUri", redirectUri,
                        "scope", String.join(" ", scopes), "state", state))
                .toUriString();
    }

    public Tokens exchangeCode(Client client, String code, String redirectUri) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", code);
        form.add("client_id", client.id());
        form.add("client_secret", client.secret());
        form.add("redirect_uri", redirectUri);
        form.add("grant_type", "authorization_code");
        return tokens(form);
    }

    /** @throws GoogleAuthException if the refresh token is revoked or expired */
    public Tokens refresh(Client client, String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", client.id());
        form.add("client_secret", client.secret());
        form.add("refresh_token", refreshToken);
        form.add("grant_type", "refresh_token");
        return tokens(form);
    }

    /** Withdraws the app's access; a token that is already invalid is fine. */
    public void revoke(String token) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("token", token);
        try {
            oauth.post().uri("/revoke").contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() != HttpStatus.BAD_REQUEST.value()) {
                throw failure("revoke", e);
            }
        } catch (RestClientException e) {
            throw new GoogleException("Google revoke: " + e.getMessage());
        }
    }

    /** @return id of the new calendar */
    public String createCalendar(String accessToken, String summary, String timeZone) {
        JsonNode created = call("create calendar", () -> calendar.post()
                .uri("/calendars")
                .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
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
                    .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RestClientResponseException e) {
            if (isGone(e)) {
                return false;
            }
            throw failure("get calendar", e);
        } catch (RestClientException e) {
            throw new GoogleException("Google get calendar: " + e.getMessage());
        }
    }

    /** Creates or replaces the event with the given id. */
    public void putEvent(String accessToken, String calendarId, String eventId, Map<String, Object> event) {
        try {
            calendar.put()
                    .uri("/calendars/{calendar}/events/{event}", calendarId, eventId)
                    .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(event)
                    .retrieve()
                    .toBodilessEntity();
            return;
        } catch (RestClientResponseException e) {
            if (!isGone(e)) {
                throw failure("update event", e);
            }
        } catch (RestClientException e) {
            throw new GoogleException("Google update event: " + e.getMessage());
        }
        Map<String, Object> withId = new LinkedHashMap<>(event);
        withId.put("id", eventId);
        call("insert event", () -> calendar.post()
                .uri("/calendars/{calendar}/events", calendarId)
                .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
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
                    .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            if (!isGone(e)) {
                throw failure("delete event", e);
            }
        } catch (RestClientException e) {
            throw new GoogleException("Google delete event: " + e.getMessage());
        }
    }

    /** Busy times of the teacher's primary calendar in {@code [from, to)}. */
    public List<Busy> busy(String accessToken, Instant from, Instant to) {
        JsonNode response = call("free/busy", () -> calendar.post()
                .uri("/freeBusy")
                .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
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

    private Tokens tokens(MultiValueMap<String, String> form) {
        JsonNode response;
        try {
            response = oauth.post()
                    .uri("/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            if ("invalid_grant".equals(errorCode(e))) {
                throw new GoogleAuthException("Google refused the authorization: " + describe(e));
            }
            throw failure("token", e);
        } catch (RestClientException e) {
            throw new GoogleException("Google token: " + e.getMessage());
        }
        String accessToken = response == null ? "" : response.path("access_token").asString("");
        if (response == null || accessToken.isEmpty()) {
            throw new GoogleException("Google did not return an access token");
        }
        String refreshToken = response.path("refresh_token").asString("");
        return new Tokens(accessToken, response.path("expires_in").asLong(3600),
                refreshToken.isEmpty() ? null : refreshToken);
    }

    private interface Call<T> {
        @Nullable T run();
    }

    private static <T> @Nullable T call(String action, Call<T> call) {
        try {
            return call.run();
        } catch (RestClientResponseException e) {
            throw failure(action, e);
        } catch (RestClientException e) {
            throw new GoogleException("Google " + action + ": " + e.getMessage());
        }
    }

    private static GoogleException failure(String action, RestClientResponseException e) {
        String message = "Google " + action + " " + e.getStatusCode().value() + ": " + describe(e);
        return e.getStatusCode().value() == HttpStatus.UNAUTHORIZED.value()
                ? new GoogleAuthException(message)
                : new GoogleException(message);
    }

    private static boolean isGone(RestClientResponseException e) {
        int status = e.getStatusCode().value();
        return status == HttpStatus.NOT_FOUND.value() || status == HttpStatus.GONE.value();
    }

    private static @Nullable String errorCode(RestClientResponseException e) {
        try {
            JsonNode body = e.getResponseBodyAs(JsonNode.class);
            JsonNode error = body == null ? null : body.path("error");
            return error == null || !error.isString() ? null : error.asString();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    /** The error text of Google's JSON error body (OAuth or API format), or the status text. */
    private static String describe(RestClientResponseException e) {
        try {
            JsonNode body = e.getResponseBodyAs(JsonNode.class);
            if (body != null) {
                JsonNode error = body.path("error");
                if (error.isString()) {
                    String description = body.path("error_description").asString("");
                    return description.isEmpty() ? error.asString() : error.asString() + " (" + description + ")";
                }
                if (error.has("message")) {
                    return error.path("message").asString();
                }
            }
        } catch (RuntimeException ignored) {
            // not a JSON error body
        }
        return e.getStatusText();
    }

    private static String bearer(String accessToken) {
        return "Bearer " + accessToken;
    }
}

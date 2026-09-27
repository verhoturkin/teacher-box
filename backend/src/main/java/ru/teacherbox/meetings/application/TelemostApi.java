package ru.teacherbox.meetings.application;

import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;

/**
 * Yandex OAuth (authorization code for a «device», so that the token can be revoked) and the
 * Telemost API ({@code POST /conferences}).
 */
public class TelemostApi {

    /** Name of the device the token is issued for, shown in the teacher's Yandex ID. */
    static final String DEVICE_NAME = "Teacher Box";

    public record Client(String id, String secret) {
    }

    public record Tokens(String accessToken, long expiresInSeconds, @Nullable String refreshToken) {
    }

    /** A Telemost meeting: its id and the link for participants. */
    public record Conference(String id, String joinUrl) {
    }

    private final RestClient oauth;
    private final RestClient api;
    private final String oauthUrl;

    public TelemostApi(RestClient oauth, RestClient api, String oauthUrl) {
        this.oauth = oauth;
        this.api = api;
        this.oauthUrl = oauthUrl;
    }

    /** Yandex's consent page; it redirects to {@code redirectUri} with a code and the state. */
    public String authorizationUrl(String clientId, String redirectUri, String state, String deviceId) {
        return UriComponentsBuilder.fromUriString(oauthUrl + "/authorize")
                .queryParam("response_type", "code")
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("state", state)
                .queryParam("device_id", deviceId)
                .queryParam("device_name", DEVICE_NAME)
                .queryParam("force_confirm", "yes")
                .encode()
                .build()
                .toUriString();
    }

    public Tokens exchangeCode(Client client, String code) {
        MultiValueMap<String, String> form = form(client);
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        return tokens(form);
    }

    public Tokens refresh(Client client, String refreshToken) {
        MultiValueMap<String, String> form = form(client);
        form.add("grant_type", "refresh_token");
        form.add("refresh_token", refreshToken);
        return tokens(form);
    }

    /** Revokes a token issued for the device. */
    public void revoke(Client client, String accessToken) {
        MultiValueMap<String, String> form = form(client);
        form.add("access_token", accessToken);
        try {
            oauth.post()
                    .uri("/revoke_token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            throw new TelemostException("Yandex revoke " + e.getStatusCode().value() + ": " + describe(e));
        } catch (RestClientException e) {
            throw new TelemostException("Yandex revoke: " + e.getMessage());
        }
    }

    /**
     * Creates a public meeting.
     *
     * @param waitingRoomLevel {@code PUBLIC} (no waiting room) or {@code ADMINS} (everybody but the
     *                         organizer waits)
     */
    public Conference createConference(String token, String waitingRoomLevel) {
        JsonNode response;
        try {
            response = api.post()
                    .uri("/conferences")
                    .header(HttpHeaders.AUTHORIZATION, "OAuth " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("waiting_room_level", waitingRoomLevel))
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            throw failure("create a meeting", e);
        } catch (RestClientException e) {
            throw new TelemostException("Telemost: " + e.getMessage());
        }
        String id = response == null ? "" : response.path("id").asString("");
        String joinUrl = response == null ? "" : response.path("join_url").asString("");
        if (id.isEmpty() || joinUrl.isEmpty()) {
            throw new TelemostException("Telemost did not return the meeting link");
        }
        return new Conference(id, joinUrl);
    }

    /**
     * Checks the token without creating anything: a meeting that does not exist is «not found» for
     * an accepted token.
     *
     * @throws TelemostAuthException if the token is not accepted
     */
    public void checkToken(String token) {
        try {
            api.get()
                    .uri("/conferences/{id}", "0")
                    .header(HttpHeaders.AUTHORIZATION, "OAuth " + token)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() != 404) {
                throw failure("check the token", e);
            }
        } catch (RestClientException e) {
            throw new TelemostException("Telemost: " + e.getMessage());
        }
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
            String error = errorCode(e);
            if ("invalid_grant".equals(error) || "bad_verification_code".equals(error)) {
                throw new TelemostAuthException("Yandex refused the authorization: " + describe(e));
            }
            throw new TelemostException("Yandex token " + e.getStatusCode().value() + ": " + describe(e));
        } catch (RestClientException e) {
            throw new TelemostException("Yandex token: " + e.getMessage());
        }
        String accessToken = response == null ? "" : response.path("access_token").asString("");
        if (response == null || accessToken.isEmpty()) {
            throw new TelemostException("Yandex did not return an access token");
        }
        String refreshToken = response.path("refresh_token").asString("");
        return new Tokens(accessToken, response.path("expires_in").asLong(31_536_000),
                refreshToken.isEmpty() ? null : refreshToken);
    }

    private static MultiValueMap<String, String> form(Client client) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", client.id());
        form.add("client_secret", client.secret());
        return form;
    }

    private static TelemostException failure(String action, RestClientResponseException e) {
        int status = e.getStatusCode().value();
        String message = "Telemost could not " + action + " (" + status + "): " + describe(e);
        return status == 401 || status == 403 ? new TelemostAuthException(message) : new TelemostException(message);
    }

    private static @Nullable String errorCode(RestClientResponseException e) {
        try {
            JsonNode body = e.getResponseBodyAs(JsonNode.class);
            return body == null ? null : body.path("error").asString(null);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static String describe(RestClientResponseException e) {
        try {
            JsonNode body = e.getResponseBodyAs(JsonNode.class);
            if (body != null) {
                for (String field : new String[] {"error_description", "description", "message", "error"}) {
                    String value = body.path(field).asString("");
                    if (!value.isEmpty()) {
                        return value;
                    }
                }
            }
        } catch (RuntimeException ignored) {
            // not a JSON error body
        }
        return e.getStatusText();
    }
}

package ru.teacherbox.shared.http;

import java.io.UncheckedIOException;
import java.util.Map;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Google OAuth 2.0 (authorization code flow for web server applications) and the mapping of Google's
 * HTTP errors, shared by every Google API client. A client keeps its own API calls and its own
 * exception types: they are passed in as factories, so the texts and the types the callers catch stay
 * theirs.
 */
public final class GoogleOAuth {

    /** OAuth client of the teacher's Google Cloud project. */
    public record Client(String id, String secret) {
    }

    /** @param refreshToken returned when the user consents (offline access) */
    public record Tokens(String accessToken, long expiresInSeconds, @Nullable String refreshToken) {
    }

    /** A call to a Google API that may throw the exceptions of {@link RestClient}. */
    public interface Call<T> {
        @Nullable T run();
    }

    private final RestClient oauth;
    private final String authorizationUrl;
    private final Function<String, ? extends RuntimeException> failure;
    private final Function<String, ? extends RuntimeException> authFailure;

    /**
     * @param oauth            client with the base address of the token and revoke endpoints
     * @param authorizationUrl address of the consent page
     * @param failure          makes the exception for a failed call (network, quota, unexpected answer)
     * @param authFailure      makes the exception for Google no longer accepting the authorization
     */
    public GoogleOAuth(RestClient oauth, String authorizationUrl,
            Function<String, ? extends RuntimeException> failure,
            Function<String, ? extends RuntimeException> authFailure) {
        this.oauth = oauth;
        this.authorizationUrl = authorizationUrl;
        this.failure = failure;
        this.authFailure = authFailure;
    }

    /**
     * The consent page; {@code prompt=consent} makes Google return a refresh token every time. The values
     * are passed as URI variables so that they are fully percent-encoded.
     *
     * @param scope scopes separated by a space
     */
    public String authorizationUrl(String clientId, String redirectUri, String scope, String state) {
        return UriComponentsBuilder.fromUriString(authorizationUrl)
                .queryParam("client_id", "{clientId}")
                .queryParam("redirect_uri", "{redirectUri}")
                .queryParam("response_type", "code")
                .queryParam("scope", "{scope}")
                .queryParam("access_type", "offline")
                .queryParam("prompt", "consent")
                .queryParam("state", "{state}")
                .encode()
                .buildAndExpand(Map.of("clientId", clientId, "redirectUri", redirectUri, "scope", scope,
                        "state", state))
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

    /** @throws RuntimeException made by {@code authFailure} if the refresh token is revoked or expired */
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
            throw failure.apply("Google revoke: " + e.getMessage());
        }
    }

    /** Runs an API call; a failure becomes the exception of the client (a 401 the auth one). */
    public <T> @Nullable T call(String action, Call<T> call) {
        try {
            return call.run();
        } catch (RestClientResponseException e) {
            throw failure(action, e);
        } catch (RestClientException | UncheckedIOException e) {
            throw failure.apply("Google " + action + ": " + e.getMessage());
        }
    }

    /** The exception for an error answer of Google: an authorization one for 401, otherwise a plain one. */
    public RuntimeException failure(String action, RestClientResponseException e) {
        return failure(action, e.getStatusCode().value(), describe(e));
    }

    /** As {@link #failure(String, RestClientResponseException)} for a status and text already read. */
    public RuntimeException failure(String action, int status, String description) {
        String message = "Google " + action + " " + status + ": " + description;
        return status == HttpStatus.UNAUTHORIZED.value() ? authFailure.apply(message) : failure.apply(message);
    }

    /** The exception for a failure that is not an answer of Google (network, no I/O). */
    public RuntimeException failure(String message) {
        return failure.apply(message);
    }

    /** The error text of Google's JSON error body (OAuth or API format), or the status text. */
    public static String describe(RestClientResponseException e) {
        return describe(e.getResponseBodyAsByteArray(), e.getStatusText());
    }

    public static String describe(byte[] response, String statusText) {
        try {
            JsonNode body = response.length == 0 ? null : JsonMapper.shared().readTree(response);
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
        return statusText;
    }

    public static String bearer(String accessToken) {
        return "Bearer " + accessToken;
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
                throw authFailure.apply("Google refused the authorization: " + describe(e));
            }
            throw failure("token", e);
        } catch (RestClientException e) {
            throw failure.apply("Google token: " + e.getMessage());
        }
        String accessToken = response == null ? "" : response.path("access_token").asString("");
        if (response == null || accessToken.isEmpty()) {
            throw failure.apply("Google did not return an access token");
        }
        String refreshToken = response.path("refresh_token").asString("");
        return new Tokens(accessToken, response.path("expires_in").asLong(3600),
                refreshToken.isEmpty() ? null : refreshToken);
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
}

package ru.teacherbox.shared.http;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/** The shared Google OAuth flow and error mapping, with exception types of the test's own. */
class GoogleOAuthTest {

    private static final String OAUTH = "https://oauth2.googleapis.com";
    private static final GoogleOAuth.Client CLIENT = new GoogleOAuth.Client("client-id", "client-secret");

    private static class Failed extends RuntimeException {
        Failed(String message) {
            super(message);
        }
    }

    private static class Refused extends Failed {
        Refused(String message) {
            super(message);
        }
    }

    private final RestClient.Builder builder = RestClient.builder().baseUrl(OAUTH);
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final GoogleOAuth google = new GoogleOAuth(builder.build(), "https://accounts.example.com/auth",
            Failed::new, Refused::new);

    @Test
    void buildsTheConsentAddressWithEncodedValues() {
        String url = google.authorizationUrl("client-id", "https://school/cb?x=1", "scope-a scope-b", "state 1");

        var params = UriComponentsBuilder.fromUriString(url).build(true).getQueryParams();
        assertThat(url).startsWith("https://accounts.example.com/auth?");
        assertThat(params.getFirst("redirect_uri")).isEqualTo("https%3A%2F%2Fschool%2Fcb%3Fx%3D1");
        assertThat(params.getFirst("scope")).isEqualTo("scope-a%20scope-b");
        assertThat(params.getFirst("state")).isEqualTo("state%201");
        assertThat(params.getFirst("access_type")).isEqualTo("offline");
        assertThat(params.getFirst("prompt")).isEqualTo("consent");
        assertThat(params.getFirst("response_type")).isEqualTo("code");
    }

    @Test
    void exchangesTheCodeAndRefreshesTokens() {
        server.expect(requestTo(OAUTH + "/token"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_FORM_URLENCODED))
                .andExpect(content().formDataContains(Map.of("code", "c", "grant_type", "authorization_code",
                        "redirect_uri", "https://school/cb", "client_id", "client-id",
                        "client_secret", "client-secret")))
                .andRespond(withSuccess("{\"access_token\": \"a1\", \"expires_in\": 59, \"refresh_token\": \"r1\"}",
                        MediaType.APPLICATION_JSON));
        server.expect(requestTo(OAUTH + "/token"))
                .andExpect(content().formDataContains(Map.of("grant_type", "refresh_token", "refresh_token", "r1")))
                .andRespond(withSuccess("{\"access_token\": \"a2\", \"refresh_token\": \"\"}",
                        MediaType.APPLICATION_JSON));

        assertThat(google.exchangeCode(CLIENT, "c", "https://school/cb"))
                .isEqualTo(new GoogleOAuth.Tokens("a1", 59, "r1"));
        assertThat(google.refresh(CLIENT, "r1")).isEqualTo(new GoogleOAuth.Tokens("a2", 3600, null));
        server.verify();
    }

    @Test
    void mapsTokenErrorsToTheCallersExceptions() {
        server.expect(requestTo(OAUTH + "/token")).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"error\": \"invalid_grant\", \"error_description\": \"revoked\"}"));
        server.expect(requestTo(OAUTH + "/token")).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON).body("{\"error\": \"invalid_grant\"}"));
        server.expect(requestTo(OAUTH + "/token")).andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                .contentType(MediaType.APPLICATION_JSON).body("{\"error\": \"invalid_client\"}"));
        server.expect(requestTo(OAUTH + "/token")).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON).body("{\"error\": {\"code\": 400}}"));
        server.expect(requestTo(OAUTH + "/token")).andRespond(withStatus(HttpStatus.BAD_GATEWAY)
                .contentType(MediaType.TEXT_PLAIN).body("<html>"));
        server.expect(requestTo(OAUTH + "/token")).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(OAUTH + "/token")).andRespond(request -> {
            throw new IOException("Connection refused");
        });

        assertThatThrownBy(() -> google.refresh(CLIENT, "x")).isInstanceOf(Refused.class)
                .hasMessage("Google refused the authorization: invalid_grant (revoked)");
        assertThatThrownBy(() -> google.refresh(CLIENT, "x")).isInstanceOf(Refused.class)
                .hasMessage("Google refused the authorization: invalid_grant");
        assertThatThrownBy(() -> google.refresh(CLIENT, "x")).isInstanceOf(Refused.class)
                .hasMessage("Google token 401: invalid_client");
        assertThatThrownBy(() -> google.refresh(CLIENT, "x")).isExactlyInstanceOf(Failed.class)
                .hasMessageStartingWith("Google token 400: ");
        assertThatThrownBy(() -> google.refresh(CLIENT, "x")).isExactlyInstanceOf(Failed.class)
                .hasMessage("Google token 502: Bad Gateway");
        assertThatThrownBy(() -> google.refresh(CLIENT, "x")).isExactlyInstanceOf(Failed.class)
                .hasMessage("Google did not return an access token");
        assertThatThrownBy(() -> google.refresh(CLIENT, "x")).isExactlyInstanceOf(Failed.class)
                .hasMessageStartingWith("Google token: ").hasMessageContaining("Connection refused");
    }

    @Test
    void revokesAccessAndIgnoresAnAlreadyInvalidToken() {
        server.expect(requestTo(OAUTH + "/revoke"))
                .andExpect(content().formDataContains(Map.of("token", "t")))
                .andRespond(withSuccess());
        server.expect(requestTo(OAUTH + "/revoke")).andRespond(withStatus(HttpStatus.BAD_REQUEST));
        server.expect(requestTo(OAUTH + "/revoke")).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        server.expect(requestTo(OAUTH + "/revoke")).andRespond(request -> {
            throw new IOException("timeout");
        });

        google.revoke("t");
        google.revoke("invalid");
        assertThatThrownBy(() -> google.revoke("x")).isExactlyInstanceOf(Failed.class)
                .hasMessage("Google revoke 500: Internal Server Error");
        assertThatThrownBy(() -> google.revoke("x")).isExactlyInstanceOf(Failed.class)
                .hasMessageStartingWith("Google revoke: ").hasMessageContaining("timeout");
    }

    @Test
    void callTurnsFailuresIntoTheCallersExceptions() {
        assertThat(google.call("ok", () -> "value")).isEqualTo("value");
        assertThatThrownBy(() -> google.call("io", () -> {
            throw new UncheckedIOException(new IOException("disk"));
        })).isExactlyInstanceOf(Failed.class).hasMessageStartingWith("Google io: ");

        server.expect(requestTo(OAUTH + "/x")).andRespond(withStatus(HttpStatus.UNAUTHORIZED));
        server.expect(requestTo(OAUTH + "/x")).andRespond(withStatus(HttpStatus.FORBIDDEN));
        RestClient client = builder.build();
        assertThatThrownBy(() -> google.call("get", () -> client.get().uri("/x").retrieve().toBodilessEntity()))
                .isInstanceOf(Refused.class).hasMessage("Google get 401: Unauthorized");
        assertThatThrownBy(() -> google.call("get", () -> client.get().uri("/x").retrieve().toBodilessEntity()))
                .isExactlyInstanceOf(Failed.class).hasMessage("Google get 403: Forbidden");
    }

    @Test
    void describesGoogleErrorBodies() {
        assertThat(GoogleOAuth.describe("{\"error\": {\"message\": \"No access\"}}".getBytes(StandardCharsets.UTF_8),
                "Forbidden")).isEqualTo("No access");
        assertThat(GoogleOAuth.describe(new byte[0], "Not Found")).isEqualTo("Not Found");
        assertThat(GoogleOAuth.describe("not json".getBytes(StandardCharsets.UTF_8), "Bad")).isEqualTo("Bad");
        assertThat(GoogleOAuth.describe("{\"other\": 1}".getBytes(StandardCharsets.UTF_8), "Bad")).isEqualTo("Bad");
        assertThat(google.failure("download", 401, "expired")).isInstanceOf(Refused.class)
                .hasMessage("Google download 401: expired");
        assertThat(google.failure("download", 500, "boom")).isExactlyInstanceOf(Failed.class);
        assertThat(google.failure("plain")).isExactlyInstanceOf(Failed.class).hasMessage("plain");
        assertThat(GoogleOAuth.bearer("tok")).isEqualTo("Bearer tok");
    }
}

package ru.teacherbox.meetings.application;

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
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/** Yandex OAuth and the Telemost API against a mock server. */
class TelemostApiTest {

    private static final String OAUTH = "https://oauth.yandex.ru";
    private static final String TELEMOST = "https://cloud-api.yandex.net/v1/telemost-api";
    private static final TelemostApi.Client CLIENT = new TelemostApi.Client("client-id", "client-secret");

    private final RestClient.Builder oauthBuilder = RestClient.builder().baseUrl(OAUTH);
    private final RestClient.Builder apiBuilder = RestClient.builder().baseUrl(TELEMOST);
    private final MockRestServiceServer oauth = MockRestServiceServer.bindTo(oauthBuilder).build();
    private final MockRestServiceServer telemost = MockRestServiceServer.bindTo(apiBuilder).build();
    private final TelemostApi api = new TelemostApi(oauthBuilder.build(), apiBuilder.build(), OAUTH);

    @Test
    void buildsTheConsentAddressForTheDevice() {
        String url = api.authorizationUrl("client-id", "https://school.example.com/api/public/meetings/yandex/callback",
                "state-1", "teacherbox-client");

        var params = UriComponentsBuilder.fromUriString(url).build(true).getQueryParams();
        assertThat(url).startsWith("https://oauth.yandex.ru/authorize?");
        assertThat(params.getFirst("response_type")).isEqualTo("code");
        assertThat(params.getFirst("client_id")).isEqualTo("client-id");
        assertThat(params.getFirst("redirect_uri"))
                .isEqualTo("https://school.example.com/api/public/meetings/yandex/callback");
        assertThat(params.getFirst("state")).isEqualTo("state-1");
        assertThat(params.getFirst("device_id")).isEqualTo("teacherbox-client");
        assertThat(params.getFirst("device_name")).isEqualTo("Teacher%20Box");
    }

    @Test
    void exchangesTheCodeAndRefreshesTokens() {
        oauth.expect(requestTo(OAUTH + "/token"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_FORM_URLENCODED))
                .andExpect(content().formDataContains(Map.of("grant_type", "authorization_code", "code", "code-1",
                        "client_id", "client-id", "client_secret", "client-secret")))
                .andRespond(withSuccess("""
                        {"access_token": "access-1", "expires_in": 31536000, "refresh_token": "refresh-1",
                         "token_type": "bearer"}
                        """, MediaType.APPLICATION_JSON));
        oauth.expect(requestTo(OAUTH + "/token"))
                .andExpect(content().formDataContains(Map.of("grant_type", "refresh_token",
                        "refresh_token", "refresh-1")))
                .andRespond(withSuccess("{\"access_token\": \"access-2\"}", MediaType.APPLICATION_JSON));

        assertThat(api.exchangeCode(CLIENT, "code-1"))
                .isEqualTo(new TelemostApi.Tokens("access-1", 31_536_000, "refresh-1"));
        assertThat(api.refresh(CLIENT, "refresh-1")).isEqualTo(new TelemostApi.Tokens("access-2", 31_536_000, null));
        oauth.verify();
    }

    @Test
    void aRefusedAuthorizationNeedsANewConsent() {
        oauth.expect(requestTo(OAUTH + "/token")).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"error\": \"invalid_grant\", \"error_description\": \"Invalid refresh token\"}"));
        oauth.expect(requestTo(OAUTH + "/token")).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON).body("{\"error\": \"invalid_client\"}"));
        oauth.expect(requestTo(OAUTH + "/token")).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        oauth.expect(requestTo(OAUTH + "/token")).andRespond(request -> {
            throw new IOException("Connection refused");
        });

        assertThatThrownBy(() -> api.refresh(CLIENT, "old")).isInstanceOf(TelemostAuthException.class)
                .hasMessageContaining("Invalid refresh token");
        assertThatThrownBy(() -> api.refresh(CLIENT, "old")).isNotInstanceOf(TelemostAuthException.class)
                .hasMessageContaining("400: invalid_client");
        assertThatThrownBy(() -> api.refresh(CLIENT, "old")).hasMessage("Yandex did not return an access token");
        assertThatThrownBy(() -> api.refresh(CLIENT, "old")).isInstanceOf(TelemostException.class)
                .hasMessageContaining("Connection refused");
    }

    @Test
    void revokesTheDeviceToken() {
        oauth.expect(requestTo(OAUTH + "/revoke_token"))
                .andExpect(content().formDataContains(Map.of("access_token", "access-1", "client_id", "client-id")))
                .andRespond(withSuccess("{\"status\": \"ok\"}", MediaType.APPLICATION_JSON));
        oauth.expect(requestTo(OAUTH + "/revoke_token")).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON).body("{\"error\": \"unsupported_token_type\"}"));
        oauth.expect(requestTo(OAUTH + "/revoke_token")).andRespond(request -> {
            throw new IOException("Connection reset");
        });

        api.revoke(CLIENT, "access-1");
        assertThatThrownBy(() -> api.revoke(CLIENT, "access-1")).hasMessageContaining("unsupported_token_type");
        assertThatThrownBy(() -> api.revoke(CLIENT, "access-1")).hasMessageContaining("Connection reset");
    }

    @Test
    void createsAMeeting() {
        telemost.expect(requestTo(TELEMOST + "/conferences"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "OAuth token-1"))
                .andExpect(jsonPath("$.waiting_room_level").value("ADMINS"))
                .andRespond(withStatus(HttpStatus.CREATED).contentType(MediaType.APPLICATION_JSON).body("""
                        {"id": "12345678901234", "join_url": "https://telemost.yandex.ru/j/12345678901234",
                         "waiting_room_level": "ADMINS"}
                        """));

        assertThat(api.createConference("token-1", "ADMINS"))
                .isEqualTo(new TelemostApi.Conference("12345678901234", "https://telemost.yandex.ru/j/12345678901234"));
        telemost.verify();
    }

    @Test
    void reportsFailuresOfTheApi() {
        telemost.expect(requestTo(TELEMOST + "/conferences")).andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                .contentType(MediaType.APPLICATION_JSON).body("{\"message\": \"Unauthorized\"}"));
        telemost.expect(requestTo(TELEMOST + "/conferences")).andRespond(withStatus(HttpStatus.PAYMENT_REQUIRED));
        telemost.expect(requestTo(TELEMOST + "/conferences")).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        telemost.expect(requestTo(TELEMOST + "/conferences")).andRespond(request -> {
            throw new IOException("Timeout");
        });

        assertThatThrownBy(() -> api.createConference("t", "PUBLIC")).isInstanceOf(TelemostAuthException.class)
                .hasMessageContaining("401");
        assertThatThrownBy(() -> api.createConference("t", "PUBLIC")).isNotInstanceOf(TelemostAuthException.class)
                .hasMessageContaining("402");
        assertThatThrownBy(() -> api.createConference("t", "PUBLIC"))
                .hasMessage("Telemost did not return the meeting link");
        assertThatThrownBy(() -> api.createConference("t", "PUBLIC")).hasMessageContaining("Timeout");
    }

    @Test
    void checksTheTokenWithAMeetingThatDoesNotExist() {
        telemost.expect(requestTo(TELEMOST + "/conferences/0")).andExpect(method(HttpMethod.GET))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));
        telemost.expect(requestTo(TELEMOST + "/conferences/0")).andRespond(withSuccess());
        telemost.expect(requestTo(TELEMOST + "/conferences/0")).andRespond(withStatus(HttpStatus.FORBIDDEN));
        telemost.expect(requestTo(TELEMOST + "/conferences/0")).andRespond(request -> {
            throw new IOException("No route");
        });

        api.checkToken("good");
        api.checkToken("good");
        assertThatThrownBy(() -> api.checkToken("bad")).isInstanceOf(TelemostAuthException.class);
        assertThatThrownBy(() -> api.checkToken("any")).hasMessageContaining("No route");
    }
}

package ru.teacherbox.meetings.application;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings of the meetings module ({@code TEACHERBOX_MEETINGS_*}).
 *
 * @param yandex   OAuth client of the teacher's application in Yandex ID; it can also be entered in
 *                 the settings page, these variables take precedence
 * @param telemost the Telemost API
 */
@ConfigurationProperties("teacherbox.meetings")
public record MeetingsProperties(@DefaultValue Yandex yandex, @DefaultValue Telemost telemost) {

    /** @param oauthUrl base address of Yandex OAuth (authorization, token and revoke endpoints) */
    public record Yandex(
            @Nullable String clientId,
            @Nullable String clientSecret,
            @DefaultValue("https://oauth.yandex.ru") String oauthUrl) {

        /** Both client settings come from the environment. */
        public boolean clientFromEnvironment() {
            return clientId != null && !clientId.isBlank() && clientSecret != null && !clientSecret.isBlank();
        }
    }

    /**
     * @param token  a ready OAuth token (for checks and E2E); takes precedence over the connection
     * @param apiUrl base address of the Telemost API
     */
    public record Telemost(
            @Nullable String token,
            @DefaultValue("https://cloud-api.yandex.net/v1/telemost-api") String apiUrl) {

        public boolean tokenFromEnvironment() {
            return token != null && !token.isBlank();
        }
    }
}

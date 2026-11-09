package ru.teacherbox.schedule.application;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings of the schedule module ({@code TEACHERBOX_SCHEDULE_*}).
 *
 * The lesson rules are the teacher's settings in {@code schedule.settings} ({@link LessonRules}, ADR-0056).
 *
 * @param google the teacher's Google Calendar
 */
@ConfigurationProperties("teacherbox.schedule")
public record ScheduleProperties(
        @DefaultValue Google google) {

    /**
     * OAuth client of the teacher's Google Cloud project. The client id and secret can also be
     * entered in the settings page; these variables take precedence.
     *
     * @param proxy            {@code http://host:port} or {@code socks5://host:port} for Google APIs
     * @param authorizationUrl Google's OAuth consent page
     * @param oauthUrl         base address of the token and revoke endpoints
     * @param apiUrl           base address of the Calendar API
     */
    public record Google(
            @Nullable String clientId,
            @Nullable String clientSecret,
            @Nullable String proxy,
            @DefaultValue("https://accounts.google.com/o/oauth2/v2/auth") String authorizationUrl,
            @DefaultValue("https://oauth2.googleapis.com") String oauthUrl,
            @DefaultValue("https://www.googleapis.com/calendar/v3") String apiUrl) {

        /** Both client settings come from the environment. */
        public boolean clientFromEnvironment() {
            return clientId != null && !clientId.isBlank() && clientSecret != null && !clientSecret.isBlank();
        }
    }
}

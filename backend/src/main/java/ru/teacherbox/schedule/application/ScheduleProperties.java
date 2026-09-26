package ru.teacherbox.schedule.application;

import java.time.Duration;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings of the schedule module ({@code TEACHERBOX_SCHEDULE_*}).
 *
 * @param defaultDuration  lesson duration in minutes when none is given
 * @param horizon          how far ahead lessons of a series are created
 * @param lateCancellation a student's cancellation later than this before the lesson is late: the
 *                         teacher decides whether to charge it
 * @param reminders        how long before a lesson reminders are sent, e.g. {@code 24h,1h}; empty = none
 * @param google           the teacher's Google Calendar
 */
@ConfigurationProperties("teacherbox.schedule")
public record ScheduleProperties(
        @DefaultValue("60") int defaultDuration,
        @DefaultValue("84d") Duration horizon,
        @DefaultValue("24h") Duration lateCancellation,
        @DefaultValue({"24h", "1h"}) List<Duration> reminders,
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

    public ScheduleProperties {
        if (defaultDuration < 1 || defaultDuration > 600) {
            throw new IllegalArgumentException("TEACHERBOX_SCHEDULE_DEFAULT_DURATION must be 1-600 minutes");
        }
        if (horizon.compareTo(Duration.ofDays(7)) < 0) {
            throw new IllegalArgumentException("TEACHERBOX_SCHEDULE_HORIZON must be at least 7 days");
        }
        if (reminders.stream().anyMatch(reminder -> reminder.isNegative() || reminder.isZero())) {
            throw new IllegalArgumentException("TEACHERBOX_SCHEDULE_REMINDERS must be positive durations");
        }
        reminders = reminders.stream().distinct().sorted().toList();
    }

    /** Whole days of the horizon. */
    public long horizonDays() {
        return horizon.toDays();
    }
}

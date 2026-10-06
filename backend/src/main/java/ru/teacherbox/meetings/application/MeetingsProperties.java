package ru.teacherbox.meetings.application;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings of the meetings module ({@code TEACHERBOX_MEETINGS_*}).
 *
 * @param livekit the media server of the built-in calls (ADR-0030)
 */
@ConfigurationProperties("teacherbox.meetings")
public record MeetingsProperties(@DefaultValue Livekit livekit) {

    /** LiveKit refuses shorter secrets. */
    public static final int MIN_SECRET_LENGTH = 32;

    /**
     * @param apiUrl    the address the backend calls; browsers always connect to {@code <portal>/livekit}
     * @param apiKey    key of the LiveKit API; calls are on when it and the secret are set
     * @param apiSecret secret of the LiveKit API, at least {@value #MIN_SECRET_LENGTH} characters
     */
    public record Livekit(
            @DefaultValue("http://livekit:7880") String apiUrl,
            @Nullable String apiKey,
            @Nullable String apiSecret) {

        public Livekit {
            apiKey = blankToNull(apiKey);
            apiSecret = blankToNull(apiSecret);
            if (apiSecret != null && apiSecret.length() < MIN_SECRET_LENGTH) {
                throw new IllegalArgumentException("TEACHERBOX_MEETINGS_LIVEKIT_API_SECRET must have at least "
                        + MIN_SECRET_LENGTH + " characters");
            }
        }

        /** Built-in calls are on: the key and the secret are set. */
        public boolean enabled() {
            return apiKey != null && apiSecret != null;
        }

        private static @Nullable String blankToNull(@Nullable String value) {
            return value == null || value.isBlank() ? null : value.strip();
        }
    }
}

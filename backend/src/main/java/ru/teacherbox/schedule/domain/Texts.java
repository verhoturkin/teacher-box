package ru.teacherbox.schedule.domain;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Normalization of optional text fields of lessons and requests. */
final class Texts {

    static final int MAX_LENGTH = 500;
    static final int MAX_URL_LENGTH = 1000;

    private Texts() {
    }

    /** Trimmed text or {@code null} when blank; longer than {@link #MAX_LENGTH} is rejected. */
    static @Nullable String optional(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        if (trimmed.length() > MAX_LENGTH) {
            throw new BusinessRuleException("schedule.text-too-long",
                    "Text must not exceed " + MAX_LENGTH + " characters");
        }
        return trimmed.isEmpty() ? null : trimmed;
    }

    /** Link to an online lesson (Zoom, Telemost, ...): an http(s) address or {@code null}. */
    static @Nullable String meetingUrl(@Nullable String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String url = value.strip();
        if (url.length() > MAX_URL_LENGTH) {
            throw new BusinessRuleException("schedule.meeting-url-invalid", "The link is too long");
        }
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!(scheme.equals("http") || scheme.equals("https")) || uri.getHost() == null) {
                throw new BusinessRuleException("schedule.meeting-url-invalid", "The link must be an http(s) address");
            }
        } catch (URISyntaxException e) {
            throw new BusinessRuleException("schedule.meeting-url-invalid", "The link is not a valid address");
        }
        return url;
    }

    static int duration(int minutes) {
        if (minutes < 1 || minutes > Lesson.MAX_DURATION_MINUTES) {
            throw new BusinessRuleException("schedule.duration-invalid",
                    "Lesson duration must be 1-" + Lesson.MAX_DURATION_MINUTES + " minutes");
        }
        return minutes;
    }
}

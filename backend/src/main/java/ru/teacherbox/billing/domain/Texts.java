package ru.teacherbox.billing.domain;

import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Normalization of optional free-text fields (topic, comment, reason). */
final class Texts {

    static final int MAX_LENGTH = 500;

    private Texts() {
    }

    /** Trimmed text or {@code null} when blank; longer than {@link #MAX_LENGTH} is rejected with {@code code}. */
    static @Nullable String optional(@Nullable String value, String code) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() > MAX_LENGTH) {
            throw new BusinessRuleException(code, "Text must not exceed " + MAX_LENGTH + " characters");
        }
        return trimmed.isEmpty() ? null : trimmed;
    }
}

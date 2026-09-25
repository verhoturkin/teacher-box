package ru.teacherbox.identity.domain;

import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * Personal data of a user. Values are trimmed; blank optional values become {@code null}.
 *
 * @param note private note of the teacher about a student (never shown to the student)
 */
public record Profile(String displayName, @Nullable String email, @Nullable String phone, @Nullable String note) {

    private static final Pattern EMAIL = Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");

    public Profile {
        displayName = displayName.trim();
        if (displayName.isEmpty() || displayName.length() > 100) {
            throw new BusinessRuleException("profile.name-invalid", "Name must be 1-100 characters long");
        }
        email = blankToNull(email);
        if (email != null && (email.length() > 254 || !EMAIL.matcher(email).matches())) {
            throw new BusinessRuleException("profile.email-invalid", "Invalid e-mail address");
        }
        phone = blankToNull(phone);
        if (phone != null && phone.length() > 32) {
            throw new BusinessRuleException("profile.phone-invalid", "Phone number is too long");
        }
        note = blankToNull(note);
        if (note != null && note.length() > 2000) {
            throw new BusinessRuleException("profile.note-invalid", "Note is too long");
        }
    }

    public static Profile named(String displayName) {
        return new Profile(displayName, null, null, null);
    }

    private static @Nullable String blankToNull(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

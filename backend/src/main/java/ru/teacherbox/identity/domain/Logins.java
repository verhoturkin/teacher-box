package ru.teacherbox.identity.domain;

import java.util.Locale;
import java.util.regex.Pattern;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Login rules: 3–50 characters, latin letters, digits, dot, dash, underscore; case-insensitive. */
public final class Logins {

    private static final Pattern VALID = Pattern.compile("[a-z0-9][a-z0-9._-]{2,49}");

    private Logins() {
    }

    /** Normalized (trimmed, lower-case) login. */
    public static String normalize(String login) {
        String normalized = login.trim().toLowerCase(Locale.ROOT);
        if (!VALID.matcher(normalized).matches()) {
            throw new BusinessRuleException("login.invalid",
                    "Login must be 3-50 characters: latin letters, digits, '.', '-', '_'");
        }
        return normalized;
    }
}

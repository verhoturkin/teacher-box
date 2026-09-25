package ru.teacherbox.identity.domain;

import ru.teacherbox.shared.error.BusinessRuleException;

/** Minimal password requirements. */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 128;

    private PasswordPolicy() {
    }

    public static void validate(String rawPassword) {
        if (rawPassword.length() < MIN_LENGTH || rawPassword.length() > MAX_LENGTH) {
            throw new BusinessRuleException("password.weak",
                    "Password must be " + MIN_LENGTH + "-" + MAX_LENGTH + " characters long");
        }
        if (rawPassword.isBlank()) {
            throw new BusinessRuleException("password.weak", "Password must not be blank");
        }
    }
}

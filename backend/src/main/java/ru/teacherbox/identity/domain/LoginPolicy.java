package ru.teacherbox.identity.domain;

import java.time.Duration;

/**
 * Brute-force protection: after {@code maxFailedAttempts} consecutive failures the account is locked
 * for {@code lockDuration}.
 */
public record LoginPolicy(int maxFailedAttempts, Duration lockDuration) {

    public LoginPolicy {
        if (maxFailedAttempts < 1) {
            throw new IllegalArgumentException("maxFailedAttempts must be positive");
        }
        if (lockDuration.isNegative() || lockDuration.isZero()) {
            throw new IllegalArgumentException("lockDuration must be positive");
        }
    }
}

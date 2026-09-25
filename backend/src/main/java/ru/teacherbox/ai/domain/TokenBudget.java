package ru.teacherbox.ai.domain;

/**
 * Tokens used in the current month against the monthly limit.
 *
 * @param limit {@code 0} means no limit
 */
public record TokenBudget(long used, long limit) {

    public TokenBudget {
        if (used < 0 || limit < 0) {
            throw new IllegalArgumentException("Token counts must not be negative");
        }
    }

    public boolean isUnlimited() {
        return limit == 0;
    }

    /** A new request is allowed while the limit has not been reached. */
    public boolean isExhausted() {
        return !isUnlimited() && used >= limit;
    }
}

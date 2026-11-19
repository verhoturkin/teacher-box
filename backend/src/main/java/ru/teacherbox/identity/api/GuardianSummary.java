package ru.teacherbox.identity.api;

import java.util.UUID;

/**
 * Public view of a guardian (a parent) for other modules.
 *
 * @param status the account's lifecycle, the same states as a student's
 */
public record GuardianSummary(UUID id, String displayName, StudentStatus status) {

    /** Accepted the invitation and may sign in. */
    public boolean isActive() {
        return status == StudentStatus.ACTIVE;
    }
}

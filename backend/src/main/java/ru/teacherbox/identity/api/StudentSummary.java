package ru.teacherbox.identity.api;

import java.util.UUID;

/** Public view of a student for other modules. */
public record StudentSummary(UUID id, String displayName, StudentStatus status) {

    /** Invited or active, i.e. not deactivated. */
    public boolean isCurrent() {
        return status != StudentStatus.DEACTIVATED;
    }
}

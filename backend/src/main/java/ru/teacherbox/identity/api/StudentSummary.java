package ru.teacherbox.identity.api;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Public view of a student for other modules.
 *
 * @param avatar address of the student's photo; {@code null}: none (the initials are shown)
 */
public record StudentSummary(UUID id, String displayName, StudentStatus status, @Nullable String avatar) {

    /** A student without a photo. */
    public StudentSummary(UUID id, String displayName, StudentStatus status) {
        this(id, displayName, status, null);
    }

    /** Invited or active, i.e. not deactivated. */
    public boolean isCurrent() {
        return status != StudentStatus.DEACTIVATED;
    }
}

package ru.teacherbox.shared.security;

import java.util.List;
import java.util.UUID;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.error.NotFoundException;

/**
 * The guard of every {@code /api/guardian/students/{studentId}/**} endpoint (ADR-0069). Implemented by the
 * identity module, used by the business modules, which know nothing about guardianships: a guardian
 * endpoint calls {@link #require} and then the same application service as the student's {@code /api/me/**}
 * one with the checked {@code studentId}.
 */
public interface GuardianAccess {

    /**
     * Lets the guardian read the data of this child.
     *
     * @throws ForbiddenException {@code access.denied} when the user is not a guardian
     * @throws NotFoundException  {@code student.not-found} when the student is not a current (invited or
     *                            active) child of this guardian, so another student's id reveals nothing
     */
    void require(CurrentUser user, UUID studentId);

    /** Ids of the guardian's current (invited or active) children; empty for anyone else. */
    List<UUID> children(UUID guardianId);
}

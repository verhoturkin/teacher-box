package ru.teacherbox.identity.api;

import java.util.List;
import java.util.UUID;

/**
 * Read-only access to guardianships for other modules (ADR-0069): whom a notice about a student also reaches,
 * which children a guardian may read. A child is "current" while invited or active; a deactivated student keeps
 * the link, but is hidden from the guardian until reactivated.
 */
public interface Guardians {

    /** {@code true} if the user is a guardian of this student and the student is current. */
    boolean isGuardianOf(UUID guardianId, UUID studentId);

    /** The guardian's current children in the order they were linked; empty for anyone else. */
    List<StudentSummary> childrenOf(UUID guardianId);

    /** The student's guardians (at most two) in the order they were linked, whatever their status. */
    List<GuardianSummary> guardiansOf(UUID studentId);
}

package ru.teacherbox.identity.api;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Read-only access to users for other modules. Other modules keep only user ids and use this
 * facade to validate them or to show names.
 */
public interface UserDirectory {

    /** Id of the (single) teacher of this instance. */
    UUID teacherId();

    Optional<StudentSummary> findStudent(UUID studentId);

    /** Summaries of the given students; unknown ids are skipped. */
    List<StudentSummary> findStudents(Collection<UUID> studentIds);

    /** Students that can currently use the system or are about to (invited). */
    List<StudentSummary> currentStudents();

    /** {@code true} if the student exists and is not deactivated. */
    default boolean isCurrentStudent(UUID studentId) {
        return findStudent(studentId).map(StudentSummary::isCurrent).orElse(false);
    }
}

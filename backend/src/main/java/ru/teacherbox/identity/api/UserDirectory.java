package ru.teacherbox.identity.api;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ru.teacherbox.shared.i18n.Language;

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

    /**
     * The language the user (the teacher or a student) chose in the interface: notifications, bot messages
     * and calendars for them are written in it (ADR-0036). Russian for an unknown user.
     */
    Language language(UUID userId);

    /** {@code true} if the student exists and is not deactivated. */
    default boolean isCurrentStudent(UUID studentId) {
        return findStudent(studentId).map(StudentSummary::isCurrent).orElse(false);
    }
}

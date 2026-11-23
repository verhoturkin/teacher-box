package ru.teacherbox.homework.api;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;

/** Read-only access to assignments for other modules (ADR-0071); the link of an assignment to a lesson is theirs. */
public interface Assignments {

    /** The given assignments in the order of the ids; deleted ones are skipped. */
    List<AssignmentSummary> find(Collection<UUID> assignmentIds);

    /**
     * Checks that the assignment can go on a lesson: it exists and is a working assignment, not a bank item.
     *
     * @throws NotFoundException {@code assignment.not-found} if there is no such assignment
     * @throws ConflictException {@code homework.bank-item} if it is a bank item
     */
    void checkLinkable(UUID assignmentId);
}

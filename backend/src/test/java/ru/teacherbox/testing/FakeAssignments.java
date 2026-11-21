package ru.teacherbox.testing;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import ru.teacherbox.homework.api.AssignmentSummary;
import ru.teacherbox.homework.api.Assignments;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;

/** In-memory {@link Assignments} for module tests that do not bootstrap homework. */
public class FakeAssignments implements Assignments {

    private final Map<UUID, AssignmentSummary> assignments = new ConcurrentHashMap<>();

    /** A working assignment, given to nobody. */
    public UUID add(String title) {
        return put(title, false);
    }

    /** An original of the bank: it never goes on a lesson. */
    public UUID addToBank(String title) {
        return put(title, true);
    }

    @Override
    public List<AssignmentSummary> find(Collection<UUID> assignmentIds) {
        return assignmentIds.stream().map(assignments::get).filter(Objects::nonNull).toList();
    }

    @Override
    public void checkLinkable(UUID assignmentId) {
        AssignmentSummary assignment = assignments.get(assignmentId);
        if (assignment == null) {
            throw new NotFoundException("assignment.not-found", "Assignment not found");
        }
        if (assignment.bank()) {
            throw new ConflictException("homework.bank-item", "A bank item is never given out");
        }
    }

    private UUID put(String title, boolean bank) {
        UUID id = Ids.newId();
        assignments.put(id, new AssignmentSummary(id, title, null, null, bank, List.of()));
        return id;
    }
}

package ru.teacherbox.testing;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import ru.teacherbox.identity.api.GuardianSummary;
import ru.teacherbox.identity.api.Guardians;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.GuardianAccess;

/**
 * In-memory guardianships (ADR-0069) for module tests that do not bootstrap the identity module: the
 * {@link GuardianAccess} guard and the {@link Guardians} facade over the students of a {@link FakeUserDirectory},
 * with the same rules — a deactivated child keeps the link but is hidden.
 */
public final class FakeGuardians implements GuardianAccess, Guardians {

    private final FakeUserDirectory directory;
    private final Map<UUID, List<UUID>> children = new ConcurrentHashMap<>();
    private final Map<UUID, String> names = new ConcurrentHashMap<>();

    public FakeGuardians(FakeUserDirectory directory) {
        this.directory = directory;
    }

    /** Registers an active guardian of these students and returns its id. */
    public UUID addGuardian(String displayName, UUID... studentIds) {
        UUID id = Ids.newId();
        names.put(id, displayName);
        children.put(id, new CopyOnWriteArrayList<>(studentIds));
        return id;
    }

    @Override
    public void require(CurrentUser user, UUID studentId) {
        if (!user.isGuardian()) {
            throw new ForbiddenException("access.denied", "Only a guardian reads a child's data here");
        }
        if (!isGuardianOf(user.id(), studentId)) {
            throw new NotFoundException("student.not-found", "Student not found");
        }
    }

    @Override
    public List<UUID> children(UUID guardianId) {
        return childrenOf(guardianId).stream().map(StudentSummary::id).toList();
    }

    @Override
    public boolean isGuardianOf(UUID guardianId, UUID studentId) {
        return children(guardianId).contains(studentId);
    }

    @Override
    public List<StudentSummary> childrenOf(UUID guardianId) {
        return children.getOrDefault(guardianId, List.of()).stream()
                .flatMap(id -> directory.findStudent(id).stream())
                .filter(StudentSummary::isCurrent)
                .toList();
    }

    @Override
    public List<GuardianSummary> guardiansOf(UUID studentId) {
        return children.entrySet().stream().filter(entry -> entry.getValue().contains(studentId))
                .map(entry -> new GuardianSummary(entry.getKey(), names.get(entry.getKey()), StudentStatus.ACTIVE))
                .toList();
    }
}

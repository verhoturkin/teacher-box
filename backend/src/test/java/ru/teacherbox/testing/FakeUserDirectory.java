package ru.teacherbox.testing;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.Ids;

/**
 * In-memory {@link UserDirectory} for module tests that do not bootstrap the identity module.
 */
public final class FakeUserDirectory implements UserDirectory {

    private final UUID teacherId = Ids.newId();
    private final Map<UUID, StudentSummary> students = new ConcurrentHashMap<>();

    /** Registers an active student and returns its id. */
    public UUID addStudent(String displayName) {
        return addStudent(displayName, StudentStatus.ACTIVE);
    }

    public UUID addStudent(String displayName, StudentStatus status) {
        UUID id = Ids.newId();
        students.put(id, new StudentSummary(id, displayName, status));
        return id;
    }

    public void setStatus(UUID studentId, StudentStatus status) {
        students.computeIfPresent(studentId, (id, s) -> new StudentSummary(id, s.displayName(), status));
    }

    @Override
    public UUID teacherId() {
        return teacherId;
    }

    @Override
    public Optional<StudentSummary> findStudent(UUID studentId) {
        return Optional.ofNullable(students.get(studentId));
    }

    @Override
    public List<StudentSummary> findStudents(Collection<UUID> studentIds) {
        return studentIds.stream().map(students::get).filter(s -> s != null).toList();
    }

    @Override
    public List<StudentSummary> currentStudents() {
        return students.values().stream().filter(StudentSummary::isCurrent).toList();
    }
}

package ru.teacherbox.identity.application;

import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.GuardianSummary;
import ru.teacherbox.identity.api.Guardians;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.GuardianshipRepository;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.GuardianAccess;

/**
 * Who may read whose data (ADR-0069): the {@link GuardianAccess} guard of the guardian endpoints and the public
 * {@link Guardians} facade. A deactivated child keeps the link but is hidden until reactivated.
 */
@Service
@Transactional(readOnly = true)
class GuardianAccessService implements GuardianAccess, Guardians {

    private final GuardianshipRepository guardianships;
    private final UserRepository users;

    GuardianAccessService(GuardianshipRepository guardianships, UserRepository users) {
        this.guardianships = guardianships;
        this.users = users;
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
        return guardianships.exists(guardianId, studentId)
                && users.findStudent(studentId).map(UserDirectoryService::summary).map(StudentSummary::isCurrent)
                        .orElse(false);
    }

    @Override
    public List<StudentSummary> childrenOf(UUID guardianId) {
        List<UUID> ids = guardianships.studentsOf(guardianId);
        List<StudentSummary> current = users.findStudentsByIds(ids).stream().map(UserDirectoryService::summary)
                .filter(StudentSummary::isCurrent).toList();
        return ids.stream().flatMap(id -> current.stream().filter(child -> child.id().equals(id))).toList();
    }

    @Override
    public List<GuardianSummary> guardiansOf(UUID studentId) {
        List<UUID> ids = guardianships.guardiansOf(studentId);
        List<User> found = users.findGuardiansByIds(ids);
        return ids.stream().flatMap(id -> found.stream().filter(guardian -> guardian.id().equals(id)))
                .map(GuardianAccessService::summary)
                .toList();
    }

    static GuardianSummary summary(User guardian) {
        return new GuardianSummary(guardian.id(), guardian.profile().displayName(),
                StudentStatus.valueOf(guardian.status().name()));
    }
}

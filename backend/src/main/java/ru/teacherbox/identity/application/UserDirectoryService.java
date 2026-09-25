package ru.teacherbox.identity.application;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.UserRepository;

/** Implementation of the public {@link UserDirectory} facade. */
@Service
@Transactional(readOnly = true)
class UserDirectoryService implements UserDirectory {

    private final UserRepository users;

    UserDirectoryService(UserRepository users) {
        this.users = users;
    }

    @Override
    public UUID teacherId() {
        return users.findTeacher()
                .map(User::id)
                .orElseThrow(() -> new IllegalStateException("Teacher account is not initialized"));
    }

    @Override
    public Optional<StudentSummary> findStudent(UUID studentId) {
        return users.findStudent(studentId).map(UserDirectoryService::summary);
    }

    @Override
    public List<StudentSummary> findStudents(Collection<UUID> studentIds) {
        return users.findStudentsByIds(studentIds).stream().map(UserDirectoryService::summary).toList();
    }

    @Override
    public List<StudentSummary> currentStudents() {
        return users.findStudents().stream()
                .map(UserDirectoryService::summary)
                .filter(StudentSummary::isCurrent)
                .toList();
    }

    private static StudentSummary summary(User user) {
        return new StudentSummary(user.id(), user.profile().displayName(), StudentStatus.valueOf(user.status().name()));
    }
}

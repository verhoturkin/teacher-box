package ru.teacherbox.identity.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.security.Role;

class UserTest {

    private static final Instant NOW = Instant.parse("2026-09-01T10:00:00Z");
    private static final LoginPolicy POLICY = new LoginPolicy(3, Duration.ofMinutes(15));

    @Test
    void newTeacherIsActiveWithNormalizedLogin() {
        User teacher = User.newTeacher(UUID.randomUUID(), " Teacher ", "hash", Profile.named("Анна"), NOW);

        assertThat(teacher.role()).isEqualTo(Role.TEACHER);
        assertThat(teacher.isTeacher()).isTrue();
        assertThat(teacher.login()).isEqualTo("teacher");
        assertThat(teacher.status()).isEqualTo(AccountStatus.ACTIVE);
        assertThat(teacher.createdAt()).isEqualTo(NOW);
        assertThat(teacher.updatedAt()).isEqualTo(NOW);
        assertThat(teacher.version()).isZero();
    }

    @Test
    void studentLifecycle() {
        User student = newStudent();
        assertThat(student.status()).isEqualTo(AccountStatus.INVITED);
        assertThat(student.login()).isNull();
        assertThat(student.passwordHash()).isNull();

        student.activate("ivan", "hash", NOW.plusSeconds(1));
        assertThat(student.status()).isEqualTo(AccountStatus.ACTIVE);
        assertThat(student.login()).isEqualTo("ivan");
        assertThat(student.passwordHash()).isEqualTo("hash");
        assertThat(student.updatedAt()).isEqualTo(NOW.plusSeconds(1));

        student.deactivate(NOW.plusSeconds(2));
        assertThat(student.status()).isEqualTo(AccountStatus.DEACTIVATED);

        student.reactivate(NOW.plusSeconds(3));
        assertThat(student.status()).isEqualTo(AccountStatus.ACTIVE);
    }

    @Test
    void reactivationWithoutCredentialsReturnsToInvited() {
        User student = newStudent();
        student.deactivate(NOW);

        student.reactivate(NOW);

        assertThat(student.status()).isEqualTo(AccountStatus.INVITED);
    }

    @Test
    void rejectsInvalidTransitions() {
        User student = newStudent();
        assertThatThrownBy(() -> student.changePassword("h", NOW)).hasMessageContaining("not active");
        assertThatThrownBy(() -> student.reactivate(NOW)).isInstanceOf(BusinessRuleException.class);

        student.activate("ivan", "hash", NOW);
        assertThatThrownBy(() -> student.activate("ivan2", "hash", NOW))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("activation");

        student.deactivate(NOW);
        assertThatThrownBy(() -> student.deactivate(NOW)).hasMessageContaining("already deactivated");
    }

    @Test
    void teacherCannotBeDeactivatedOrActivated() {
        User teacher = User.newTeacher(UUID.randomUUID(), "teacher", "hash", Profile.named("T"), NOW);

        assertThatThrownBy(() -> teacher.deactivate(NOW)).hasMessageContaining("only allowed for students");
        assertThatThrownBy(() -> teacher.activate("x", "y", NOW)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> teacher.reactivate(NOW)).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void aNewPasswordEndsTheRequiredChange() {
        User teacher = User.newTeacher(UUID.randomUUID(), "teacher", "hash", Profile.named("T"), NOW);
        assertThat(teacher.passwordChangeRequired()).isFalse();

        teacher.requirePasswordChange();
        assertThat(teacher.passwordChangeRequired()).isTrue();
        teacher.changePassword("new-hash", NOW);

        assertThat(teacher.passwordChangeRequired()).isFalse();
    }

    @Test
    void locksAfterTooManyFailedLogins() {
        User user = activeStudent();

        user.recordFailedLogin(POLICY, NOW);
        user.recordFailedLogin(POLICY, NOW);
        assertThat(user.failedLogins()).isEqualTo(2);
        assertThat(user.isLocked(NOW)).isFalse();

        user.recordFailedLogin(POLICY, NOW);

        assertThat(user.isLocked(NOW)).isTrue();
        assertThat(user.lockedUntil()).isEqualTo(NOW.plus(Duration.ofMinutes(15)));
        assertThat(user.failedLogins()).isZero();
        assertThat(user.isLocked(NOW.plus(Duration.ofMinutes(15)))).isFalse();
    }

    @Test
    void successfulLoginResetsFailures() {
        User user = activeStudent();
        user.recordFailedLogin(POLICY, NOW);

        user.recordSuccessfulLogin(NOW.plusSeconds(5));

        assertThat(user.failedLogins()).isZero();
        assertThat(user.lockedUntil()).isNull();
        assertThat(user.updatedAt()).isEqualTo(NOW.plusSeconds(5));
    }

    @Test
    void successfulLoginWithoutFailuresChangesNothing() {
        User user = activeStudent();
        Instant before = user.updatedAt();

        user.recordSuccessfulLogin(NOW.plusSeconds(5));

        assertThat(user.updatedAt()).isEqualTo(before);
    }

    @Test
    void passwordChangeResetsLock() {
        User user = activeStudent();
        for (int i = 0; i < 3; i++) {
            user.recordFailedLogin(POLICY, NOW);
        }

        user.changePassword("new-hash", NOW);

        assertThat(user.passwordHash()).isEqualTo("new-hash");
        assertThat(user.isLocked(NOW)).isFalse();
    }

    @Test
    void profileUpdateAndVersion() {
        User user = newStudent();

        user.updateProfile(new Profile("Пётр", "p@example.com", null, null), NOW.plusSeconds(9));
        user.markSaved(4);

        assertThat(user.profile().displayName()).isEqualTo("Пётр");
        assertThat(user.updatedAt()).isEqualTo(NOW.plusSeconds(9));
        assertThat(user.version()).isEqualTo(4);
    }

    @Test
    void restoreKeepsAllFields() {
        UUID id = UUID.randomUUID();
        Avatar avatar = new Avatar("key", "image/png");
        User user = User.restore(id, Role.STUDENT, "login", "hash", Profile.named("N"), "Ника", avatar,
                AccountStatus.ACTIVE, 2, NOW, true, NOW.minusSeconds(60), NOW, 7);

        assertThat(user.id()).isEqualTo(id);
        assertThat(user.ownName()).isEqualTo("Ника");
        assertThat(user.shownName()).isEqualTo("Ника");
        assertThat(user.avatar()).isEqualTo(avatar);
        assertThat(user.failedLogins()).isEqualTo(2);
        assertThat(user.lockedUntil()).isEqualTo(NOW);
        assertThat(user.passwordChangeRequired()).isTrue();
        assertThat(user.createdAt()).isEqualTo(NOW.minusSeconds(60));
        assertThat(user.version()).isEqualTo(7);
    }

    private static User newStudent() {
        return User.newStudent(UUID.randomUUID(), Profile.named("Иван"), NOW);
    }

    private static User activeStudent() {
        User user = newStudent();
        user.activate("ivan", "hash", NOW);
        return user;
    }

    @Test
    void aStudentChoosesTheirOwnNameAndTheProfileKeepsTheTeachers() {
        User student = newStudent();
        String teachers = student.profile().displayName();

        student.renameSelf("  Ника ", NOW.plusSeconds(5));
        assertThat(student.ownName()).isEqualTo("Ника");
        assertThat(student.shownName()).isEqualTo("Ника");
        assertThat(student.profile().displayName()).isEqualTo(teachers);
        assertThat(student.updatedAt()).isEqualTo(NOW.plusSeconds(5));

        student.renameSelf(" ", NOW);
        assertThat(student.ownName()).isNull();
        assertThat(student.shownName()).isEqualTo(teachers);
        student.renameSelf(null, NOW);
        assertThat(student.ownName()).isNull();
        assertThatThrownBy(() -> student.renameSelf("я".repeat(101), NOW))
                .isInstanceOfSatisfying(BusinessRuleException.class,
                        e -> assertThat(e.code()).isEqualTo("profile.name-invalid"));
    }

    @Test
    void onlyAStudentHasAnOwnNameAndAPhoto() {
        User teacher = User.newTeacher(UUID.randomUUID(), "teacher", "hash", Profile.named("Анна"), NOW);

        assertThatThrownBy(() -> teacher.renameSelf("Аня", NOW)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> teacher.changeAvatar(new Avatar("k", "image/png"), NOW))
                .isInstanceOf(BusinessRuleException.class);
        assertThat(teacher.shownName()).isEqualTo("Анна");
    }

    @Test
    void aNewPhotoReturnsThePreviousOne() {
        User student = newStudent();
        Avatar first = new Avatar("first", "image/png");

        assertThat(student.changeAvatar(first, NOW)).isNull();
        assertThat(student.changeAvatar(new Avatar("second", "image/jpeg"), NOW)).isEqualTo(first);
        assertThat(student.changeAvatar(null, NOW)).isEqualTo(new Avatar("second", "image/jpeg"));
        assertThat(student.avatar()).isNull();
    }
}

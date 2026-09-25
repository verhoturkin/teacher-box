package ru.teacherbox.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import ru.teacherbox.identity.domain.Profile;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.Ids;

@IdentityIntegrationTest
class UserRepositoryIntegrationTests {

    @Autowired
    UserRepository users;

    @Test
    void detectsConcurrentModification() {
        User student = User.newStudent(Ids.newId(), Profile.named("Параллельный"), Instant.now());
        users.insert(student);
        User first = users.findById(student.id()).orElseThrow();
        User second = users.findById(student.id()).orElseThrow();

        first.updateProfile(Profile.named("Первое изменение"), Instant.now());
        users.update(first);
        second.updateProfile(Profile.named("Второе изменение"), Instant.now());

        assertThat(first.version()).isEqualTo(1);
        assertThatThrownBy(() -> users.update(second)).isInstanceOf(OptimisticLockingFailureException.class);
        assertThat(users.findById(student.id()).orElseThrow().profile().displayName()).isEqualTo("Первое изменение");
    }

    @Test
    void databaseAllowsOnlyOneTeacher() {
        User secondTeacher = User.newTeacher(Ids.newId(), "second-teacher", "hash", Profile.named("Второй"),
                Instant.now());

        assertThatThrownBy(() -> users.insert(secondTeacher)).isInstanceOf(DataIntegrityViolationException.class);
    }
}

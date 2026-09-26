package ru.teacherbox.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import ru.teacherbox.identity.domain.Profile;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.error.BusinessRuleException;

class TeacherBootstrapTest {

    private static final Instant NOW = Instant.parse("2026-09-01T10:00:00Z");

    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder encoder = PasswordEncoderFactories.createDelegatingPasswordEncoder();
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void createsTeacherWithGeneratedPassword() {
        when(users.findTeacher()).thenReturn(Optional.empty());

        bootstrap(new IdentityProperties.Teacher("Admin", null, "Анна", false)).run(new DefaultApplicationArguments());

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(users).insert(saved.capture());
        assertThat(saved.getValue().login()).isEqualTo("admin");
        assertThat(saved.getValue().isTeacher()).isTrue();
        assertThat(saved.getValue().profile().displayName()).isEqualTo("Анна");
        assertThat(saved.getValue().passwordHash()).startsWith("{bcrypt}");
    }

    @Test
    void createsTeacherWithConfiguredPassword() {
        when(users.findTeacher()).thenReturn(Optional.empty());

        bootstrap(new IdentityProperties.Teacher("teacher", "configured-pass", "T", false))
                .run(new DefaultApplicationArguments());

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(users).insert(saved.capture());
        String hash = saved.getValue().passwordHash();
        assertThat(hash).isNotNull();
        assertThat(encoder.matches("configured-pass", hash)).isTrue();
    }

    @Test
    void rejectsWeakConfiguredPassword() {
        when(users.findTeacher()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> bootstrap(new IdentityProperties.Teacher("teacher", "weak", "T", false))
                .run(new DefaultApplicationArguments()))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void keepsExistingTeacherUntouched() {
        User teacher = existingTeacher();
        when(users.findTeacher()).thenReturn(Optional.of(teacher));

        bootstrap(new IdentityProperties.Teacher("teacher", "other-password", "T", false))
                .run(new DefaultApplicationArguments());

        verify(users, never()).insert(any());
        verify(users, never()).update(any());
    }

    @Test
    void resetsPasswordWhenRequested() {
        User teacher = existingTeacher();
        when(users.findTeacher()).thenReturn(Optional.of(teacher));

        bootstrap(new IdentityProperties.Teacher("teacher", "recovered-pass", "T", true))
                .run(new DefaultApplicationArguments());

        verify(users).update(teacher);
        String hash = teacher.passwordHash();
        assertThat(hash).isNotNull();
        assertThat(encoder.matches("recovered-pass", hash)).isTrue();
    }

    @Test
    void resetWithoutPasswordDoesNothing() {
        when(users.findTeacher()).thenReturn(Optional.of(existingTeacher()));

        bootstrap(new IdentityProperties.Teacher("teacher", " ", "T", true)).run(new DefaultApplicationArguments());

        verify(users, never()).update(any());
    }

    private TeacherBootstrap bootstrap(IdentityProperties.Teacher teacher) {
        IdentityProperties properties = new IdentityProperties(teacher, new IdentityProperties.Admin("admin", null),
                Duration.ofMinutes(15), Duration.ofDays(30),
                Duration.ofSeconds(20), Duration.ofDays(7), 5, Duration.ofMinutes(15));
        return new TeacherBootstrap(users, encoder, properties, clock);
    }

    private User existingTeacher() {
        return User.newTeacher(UUID.randomUUID(), "teacher", encoder.encode("old-password"), Profile.named("T"), NOW);
    }
}

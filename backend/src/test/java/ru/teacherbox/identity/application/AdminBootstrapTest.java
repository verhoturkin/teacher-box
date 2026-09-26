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
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import ru.teacherbox.identity.domain.AccountStatus;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.security.Role;

class AdminBootstrapTest {

    private static final Instant NOW = Instant.parse("2026-10-01T10:00:00Z");

    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder encoder = PasswordEncoderFactories.createDelegatingPasswordEncoder();
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void createsTheAdministratorWhenAPasswordIsSet() {
        when(users.findAdministrator()).thenReturn(Optional.empty());

        run(" Admin ", "admin-pass-1");

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(users).insert(saved.capture());
        assertThat(saved.getValue().role()).isEqualTo(Role.ADMIN);
        assertThat(saved.getValue().login()).isEqualTo("admin");
        assertThat(saved.getValue().profile().displayName()).isEqualTo("Администратор");
        assertThat(encoder.matches("admin-pass-1", saved.getValue().passwordHash())).isTrue();
        assertThat(saved.getValue().isTeacher()).isFalse();
    }

    @Test
    void doesNotTakeAStudentsLogin() {
        when(users.findAdministrator()).thenReturn(Optional.empty());
        when(users.existsByLogin("admin")).thenReturn(true);

        run("admin", "admin-pass-1");

        verify(users, never()).insert(any());
    }

    @Test
    void rejectsAWeakPassword() {
        when(users.findAdministrator()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> run("admin", "short")).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void keepsAPasswordChangedInTheInterface() {
        when(users.findAdministrator()).thenReturn(Optional.of(administrator()));

        run("admin", "admin-pass-1");

        verify(users, never()).update(any());
        verify(users, never()).insert(any());
    }

    @Test
    void disablesTheAdministratorWithoutAPassword() {
        User admin = administrator();
        when(users.findAdministrator()).thenReturn(Optional.of(admin));

        run("admin", " ");

        verify(users).update(admin);
        assertThat(admin.status()).isEqualTo(AccountStatus.DEACTIVATED);
        assertThat(admin.passwordHash()).isNull();
        run("admin", null);
        verify(users).update(admin);
    }

    @Test
    void enablesTheAdministratorAgain() {
        User admin = administrator();
        admin.disableAdministrator(NOW);
        when(users.findAdministrator()).thenReturn(Optional.of(admin));

        run("admin", "new-admin-pass");

        verify(users).update(admin);
        assertThat(admin.status()).isEqualTo(AccountStatus.ACTIVE);
        assertThat(encoder.matches("new-admin-pass", admin.passwordHash())).isTrue();
    }

    @Test
    void onlyTheAdministratorCanBeSwitched() {
        User student = User.newStudent(UUID.randomUUID(), ru.teacherbox.identity.domain.Profile.named("S"), NOW);

        assertThatThrownBy(() -> student.disableAdministrator(NOW)).isInstanceOf(BusinessRuleException.class);
    }

    private void run(String login, @Nullable String password) {
        IdentityProperties properties = new IdentityProperties(
                new IdentityProperties.Teacher("teacher", null, "Учитель", false),
                new IdentityProperties.Admin(login, password), Duration.ofMinutes(15), Duration.ofDays(30),
                Duration.ofSeconds(20), Duration.ofDays(7), 5, Duration.ofMinutes(15));
        new AdminBootstrap(users, encoder, properties, clock).run(new DefaultApplicationArguments());
    }

    private User administrator() {
        return User.newAdministrator(UUID.randomUUID(), "admin", encoder.encode("old-admin-pass"), NOW);
    }
}

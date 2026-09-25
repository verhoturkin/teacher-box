package ru.teacherbox.identity.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Value rules: logins, passwords, profiles, login policy. */
class IdentityRulesTest {

    @Test
    void loginsAreNormalizedAndValidated() {
        assertThat(Logins.normalize("  Ivan.Petrov_1 ")).isEqualTo("ivan.petrov_1");
        assertThatThrownBy(() -> Logins.normalize("ab")).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> Logins.normalize("иван")).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> Logins.normalize("-dash")).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> Logins.normalize("a".repeat(51))).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void passwordPolicy() {
        assertThatCode(() -> PasswordPolicy.validate("12345678")).doesNotThrowAnyException();
        assertThatThrownBy(() -> PasswordPolicy.validate("1234567"))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(e -> ((BusinessRuleException) e).code()).isEqualTo("password.weak");
        assertThatThrownBy(() -> PasswordPolicy.validate("x".repeat(129))).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> PasswordPolicy.validate("          ")).hasMessageContaining("blank");
    }

    @Test
    void profileNormalizesValues() {
        Profile profile = new Profile("  Иван  ", "  ", " +7 900 ", "\tзаметка ");

        assertThat(profile.displayName()).isEqualTo("Иван");
        assertThat(profile.email()).isNull();
        assertThat(profile.phone()).isEqualTo("+7 900");
        assertThat(profile.note()).isEqualTo("заметка");
        assertThat(Profile.named("A")).isEqualTo(new Profile("A", null, null, null));
    }

    @Test
    void profileValidation() {
        assertThatThrownBy(() -> Profile.named(" ")).hasMessageContaining("Name");
        assertThatThrownBy(() -> Profile.named("x".repeat(101))).hasMessageContaining("Name");
        assertThatThrownBy(() -> new Profile("A", "not-an-email", null, null)).hasMessageContaining("e-mail");
        assertThatThrownBy(() -> new Profile("A", "a@b.c".repeat(60), null, null)).hasMessageContaining("e-mail");
        assertThatThrownBy(() -> new Profile("A", null, "1".repeat(33), null)).hasMessageContaining("Phone");
        assertThatThrownBy(() -> new Profile("A", null, null, "n".repeat(2001))).hasMessageContaining("Note");
        assertThat(new Profile("A", "user@mail.ru", null, null).email()).isEqualTo("user@mail.ru");
    }

    @Test
    void loginPolicyValidation() {
        assertThatThrownBy(() -> new LoginPolicy(0, Duration.ofMinutes(1))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new LoginPolicy(1, Duration.ZERO)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new LoginPolicy(1, Duration.ofSeconds(-1))).isInstanceOf(IllegalArgumentException.class);
    }
}

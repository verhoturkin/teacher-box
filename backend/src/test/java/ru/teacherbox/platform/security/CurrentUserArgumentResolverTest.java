package ru.teacherbox.platform.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.oauth2.jwt.Jwt;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.Role;

class CurrentUserArgumentResolverTest {

    @Test
    void mapsClaimsToCurrentUser() {
        UUID id = UUID.randomUUID();
        Jwt jwt = jwt().subject(id.toString()).claim("role", "STUDENT").claim("name", "Ivan").build();

        CurrentUser user = CurrentUserArgumentResolver.fromJwt(jwt);

        assertThat(user).isEqualTo(new CurrentUser(id, Role.STUDENT, "Ivan"));
    }

    @Test
    void nameIsOptional() {
        Jwt jwt = jwt().subject(UUID.randomUUID().toString()).claim("role", "TEACHER").build();

        assertThat(CurrentUserArgumentResolver.fromJwt(jwt).displayName()).isEmpty();
    }

    @Test
    void rejectsTokensWithoutSubjectOrRole() {
        Jwt noRole = jwt().subject(UUID.randomUUID().toString()).build();
        Jwt noSubject = jwt().claim("role", "TEACHER").build();

        assertThatThrownBy(() -> CurrentUserArgumentResolver.fromJwt(noRole))
                .isInstanceOf(AuthenticationCredentialsNotFoundException.class);
        assertThatThrownBy(() -> CurrentUserArgumentResolver.fromJwt(noSubject))
                .isInstanceOf(AuthenticationCredentialsNotFoundException.class);
    }

    private static Jwt.Builder jwt() {
        return Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .issuedAt(Instant.now())
                .claim("scope", "api");
    }
}

package ru.teacherbox.platform.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.JwtClaims;
import ru.teacherbox.shared.security.Role;

@SpringBootTest
@AutoConfigureMockMvc
class PlatformSecurityIntegrationTest {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    JwtEncoder jwtEncoder;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Test
    void anonymousIsRejectedWithProblemDetail() {
        assertThat(mvc.get().uri("/api/me/whoami"))
                .hasStatus(HttpStatus.UNAUTHORIZED)
                .hasHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
                .bodyJson().extractingPath("$.code").isEqualTo("auth.required");
    }

    @Test
    void authEndpointsArePublic() {
        assertThat(mvc.get().uri("/api/auth/ping")).hasStatusOk().hasBodyTextEqualTo("pong");
    }

    @Test
    void authenticatedUserIsResolved() {
        UUID id = UUID.randomUUID();

        assertThat(mvc.get().uri("/api/me/whoami").header(HttpHeaders.AUTHORIZATION, bearer(id, Role.STUDENT)))
                .hasStatusOk()
                .bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.id").isEqualTo(id.toString());
                    assertThat(json).extractingPath("$.role").isEqualTo("STUDENT");
                    assertThat(json).extractingPath("$.displayName").isEqualTo("Test User");
                });
    }

    @Test
    void teacherAreaRequiresTeacherRole() {
        assertThat(mvc.get().uri("/api/teacher/secret")
                .header(HttpHeaders.AUTHORIZATION, bearer(UUID.randomUUID(), Role.STUDENT)))
                .hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson().extractingPath("$.code").isEqualTo("access.denied");

        assertThat(mvc.get().uri("/api/teacher/secret")
                .header(HttpHeaders.AUTHORIZATION, bearer(UUID.randomUUID(), Role.TEACHER)))
                .hasStatusOk();
    }

    @Test
    void rejectsTamperedAndExpiredTokens() {
        String token = bearer(UUID.randomUUID(), Role.TEACHER);
        String tampered = token.substring(0, token.length() - 2) + (token.endsWith("A") ? "BB" : "AA");

        assertThat(mvc.get().uri("/api/me/whoami").header(HttpHeaders.AUTHORIZATION, tampered))
                .hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(mvc.get().uri("/api/me/whoami").header(HttpHeaders.AUTHORIZATION,
                bearer(UUID.randomUUID(), Role.TEACHER, Instant.now().minus(1, ChronoUnit.HOURS))))
                .hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void nonApiPathsArePublic() {
        assertThat(mvc.get().uri("/some/spa/route")).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void securityHeadersAreSent() {
        assertThat(mvc.get().uri("/api/auth/ping"))
                .hasHeader("Content-Security-Policy", PlatformSecurityAutoConfiguration.CONTENT_SECURITY_POLICY)
                .hasHeader("Permissions-Policy", PlatformSecurityAutoConfiguration.PERMISSIONS_POLICY)
                .hasHeader("Referrer-Policy", "strict-origin-when-cross-origin")
                .hasHeader("X-Content-Type-Options", "nosniff")
                .hasHeader("X-Frame-Options", "DENY");
    }

    @Test
    void passwordEncoderUsesBcryptByDefault() {
        String hash = passwordEncoder.encode("secret-password");

        assertThat(hash).startsWith("{bcrypt}");
        assertThat(passwordEncoder.matches("secret-password", hash)).isTrue();
    }

    private String bearer(UUID id, Role role) {
        return bearer(id, role, Instant.now());
    }

    private String bearer(UUID id, Role role, Instant issuedAt) {
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(id.toString())
                .issuedAt(issuedAt)
                .expiresAt(issuedAt.plus(15, ChronoUnit.MINUTES))
                .claim(JwtClaims.ROLE, role.name())
                .claim(JwtClaims.NAME, "Test User")
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return "Bearer " + jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    @TestConfiguration
    static class Endpoints {

        @Bean
        ProbeController probeController() {
            return new ProbeController();
        }
    }

    @RestController
    static class ProbeController {

        @GetMapping("/api/auth/ping")
        String ping() {
            return "pong";
        }

        @GetMapping("/api/me/whoami")
        CurrentUser whoami(CurrentUser user) {
            return user;
        }

        @GetMapping("/api/teacher/secret")
        String secret() {
            return "ok";
        }
    }
}

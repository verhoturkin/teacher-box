package ru.teacherbox.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.identity.IdentityTestSupport.activeStudent;
import static ru.teacherbox.identity.IdentityTestSupport.login;
import static ru.teacherbox.identity.IdentityTestSupport.signIn;
import static ru.teacherbox.identity.IdentityTestSupport.signInTeacher;
import static ru.teacherbox.identity.IdentityTestSupport.tokens;

import jakarta.servlet.http.Cookie;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.identity.IdentityTestSupport.ActiveStudent;
import ru.teacherbox.identity.IdentityTestSupport.Tokens;
import ru.teacherbox.identity.application.InviteService;
import ru.teacherbox.identity.application.StudentAdminService;
import ru.teacherbox.testing.MutableClock;

@IdentityIntegrationTest
class AuthFlowIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    MutableClock clock;

    @Autowired
    StudentAdminService students;

    @Autowired
    InviteService invites;

    @Test
    void teacherSignsInWithConfiguredCredentials() {
        MvcTestResult result = login(mvc, "Teacher", IdentityTestSupport.TEACHER_PASSWORD);

        assertThat(result).hasStatusOk()
                .hasHeader(HttpHeaders.CACHE_CONTROL, "no-store")
                .bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.expiresIn").isEqualTo(900);
                    assertThat(json).extractingPath("$.user.role").isEqualTo("TEACHER");
                    assertThat(json).extractingPath("$.user.displayName").isEqualTo("Анна Сергеевна");
                });
        assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE))
                .contains("tb_refresh=", "HttpOnly", "SameSite=Strict", "Path=/api/auth")
                .doesNotContain("Secure");

        Tokens tokens = tokens(result);
        assertThat(mvc.get().uri("/api/me").header(HttpHeaders.AUTHORIZATION, tokens.bearer()))
                .hasStatusOk()
                .bodyJson().extractingPath("$.login").isEqualTo("teacher");
    }

    @Test
    void refreshCookieIsSecureOverHttps() {
        MvcTestResult result = mvc.post().uri("/api/auth/login").secure(true)
                .contentType("application/json")
                .content("{\"login\":\"teacher\",\"password\":\"%s\"}".formatted(IdentityTestSupport.TEACHER_PASSWORD))
                .exchange();

        assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)).contains("Secure");
    }

    @Test
    void rejectsWrongCredentialsWithoutRevealingTheReason() {
        assertThat(login(mvc, "teacher", "wrong-password"))
                .hasStatus(HttpStatus.UNAUTHORIZED)
                .bodyJson().extractingPath("$.code").isEqualTo("auth.invalid-credentials");
        assertThat(login(mvc, "nobody", "whatever-password"))
                .hasStatus(HttpStatus.UNAUTHORIZED)
                .bodyJson().extractingPath("$.code").isEqualTo("auth.invalid-credentials");
    }

    @Test
    void blankCredentialsFailValidation() {
        assertThat(login(mvc, "", "whatever-password"))
                .hasStatus(HttpStatus.BAD_REQUEST)
                .bodyJson().extractingPath("$.errors.login").isNotNull();
    }

    @Test
    void locksAccountAfterRepeatedFailures() {
        ActiveStudent student = activeStudent(students, invites, "Блокируемый");
        for (int i = 0; i < 3; i++) {
            assertThat(login(mvc, student.login(), "wrong-password")).hasStatus(HttpStatus.UNAUTHORIZED);
        }

        assertThat(login(mvc, student.login(), student.password()))
                .hasStatus(HttpStatus.UNAUTHORIZED)
                .bodyJson().extractingPath("$.code").isEqualTo("auth.locked");

        clock.advance(Duration.ofMinutes(16));
        assertThat(login(mvc, student.login(), student.password())).hasStatusOk();
    }

    @Test
    void refreshRotatesTokens() {
        Tokens initial = signInTeacher(mvc);

        MvcTestResult refreshed = refresh(initial.cookie());

        assertThat(refreshed).hasStatusOk().bodyJson().extractingPath("$.user.role").isEqualTo("TEACHER");
        Tokens next = tokens(refreshed);
        assertThat(next.refreshToken()).isNotEqualTo(initial.refreshToken());
        assertThat(refresh(next.cookie())).hasStatusOk();
    }

    @Test
    void concurrentRefreshWithinGracePeriodIsAccepted() {
        Tokens initial = signInTeacher(mvc);
        assertThat(refresh(initial.cookie())).hasStatusOk();

        clock.advance(Duration.ofSeconds(5));

        assertThat(refresh(initial.cookie())).hasStatusOk();
    }

    @Test
    void reuseOfRotatedTokenRevokesTheWholeSession() {
        Tokens initial = signInTeacher(mvc);
        Tokens next = tokens(refresh(initial.cookie()));

        clock.advance(Duration.ofMinutes(1));

        assertThat(refresh(initial.cookie()))
                .hasStatus(HttpStatus.UNAUTHORIZED)
                .bodyJson().extractingPath("$.code").isEqualTo("auth.refresh-invalid");
        assertThat(refresh(next.cookie())).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void refreshRequiresValidCookie() {
        assertThat(mvc.post().uri("/api/auth/refresh"))
                .hasStatus(HttpStatus.UNAUTHORIZED)
                .bodyJson().extractingPath("$.code").isEqualTo("auth.refresh-invalid");
        assertThat(refresh(new Cookie(IdentityTestSupport.COOKIE, "forged"))).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void refreshTokenExpires() {
        Tokens tokens = signInTeacher(mvc);

        clock.advance(Duration.ofDays(31));

        assertThat(refresh(tokens.cookie())).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void logoutEndsSessionAndClearsCookie() {
        Tokens tokens = signInTeacher(mvc);

        MvcTestResult result = mvc.post().uri("/api/auth/logout").cookie(tokens.cookie()).exchange();

        assertThat(result).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)).contains("Max-Age=0");
        assertThat(refresh(tokens.cookie())).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void logoutWithoutCookieIsHarmless() {
        assertThat(mvc.post().uri("/api/auth/logout")).hasStatus(HttpStatus.NO_CONTENT);
    }

    @Test
    void deactivatedStudentLosesAccess() {
        ActiveStudent student = activeStudent(students, invites, "Уходящий");
        Tokens tokens = signIn(mvc, student.login(), student.password());

        students.deactivate(student.id());

        assertThat(refresh(tokens.cookie())).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(login(mvc, student.login(), student.password()))
                .hasStatus(HttpStatus.UNAUTHORIZED)
                .bodyJson().extractingPath("$.code").isEqualTo("auth.deactivated");
    }

    private MvcTestResult refresh(Cookie cookie) {
        return mvc.post().uri("/api/auth/refresh").cookie(cookie).exchange();
    }
}

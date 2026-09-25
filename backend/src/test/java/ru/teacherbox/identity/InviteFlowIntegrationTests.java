package ru.teacherbox.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.identity.IdentityTestSupport.activeStudent;
import static ru.teacherbox.identity.IdentityTestSupport.login;
import static ru.teacherbox.identity.IdentityTestSupport.signIn;
import static ru.teacherbox.identity.IdentityTestSupport.tokens;
import static ru.teacherbox.identity.IdentityTestSupport.uniqueLogin;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.identity.IdentityTestSupport.ActiveStudent;
import ru.teacherbox.identity.IdentityTestSupport.Tokens;
import ru.teacherbox.identity.api.StudentActivated;
import ru.teacherbox.identity.application.InviteService;
import ru.teacherbox.identity.application.StudentAdminService;
import ru.teacherbox.identity.domain.Profile;
import ru.teacherbox.testing.MutableClock;

@IdentityIntegrationTest
class InviteFlowIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    MutableClock clock;

    @Autowired
    StudentAdminService students;

    @Autowired
    InviteService invites;

    @Test
    void studentActivatesAccountAndIsSignedIn(AssertablePublishedEvents events) {
        StudentAdminService.CreatedStudent created = students.create(Profile.named("Алиса"));
        String token = created.invite().token();
        String login = uniqueLogin("Alice");

        assertThat(mvc.get().uri("/api/auth/invites/" + token)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.purpose").isEqualTo("ACTIVATION");
            assertThat(json).extractingPath("$.displayName").isEqualTo("Алиса");
        });

        MvcTestResult accepted = accept(token, login, "alice-password");

        assertThat(accepted).hasStatusOk().bodyJson().extractingPath("$.user.role").isEqualTo("STUDENT");
        Tokens tokens = tokens(accepted);
        assertThat(mvc.get().uri("/api/me").header(HttpHeaders.AUTHORIZATION, tokens.bearer()))
                .hasStatusOk()
                .bodyJson().extractingPath("$.login").isEqualTo(login.toLowerCase());
        assertThat(login(mvc, login, "alice-password")).hasStatusOk();
        assertThat(events).contains(StudentActivated.class)
                .matching(StudentActivated::studentId, created.student().id());

        assertThat(accept(token, uniqueLogin("again"), "alice-password"))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("invite.invalid");
    }

    @Test
    void activationValidatesLoginAndPassword() {
        ActiveStudent existing = activeStudent(students, invites, "Первый");
        String token = students.create(Profile.named("Второй")).invite().token();

        assertThat(accept(token, existing.login(), "good-password"))
                .hasStatus(HttpStatus.CONFLICT)
                .bodyJson().extractingPath("$.code").isEqualTo("login.taken");
        assertThat(accept(token, null, "good-password"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("login.required");
        assertThat(accept(token, "x!", "good-password"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("login.invalid");
        assertThat(accept(token, uniqueLogin("second"), "short"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("password.weak");
        assertThat(accept(token, uniqueLogin("second"), "long-enough")).hasStatusOk();
    }

    @Test
    void passwordResetKeepsLoginAndEndsOldSessions() {
        ActiveStudent student = activeStudent(students, invites, "Забыл пароль");
        Tokens oldSession = signIn(mvc, student.login(), student.password());
        String token = students.reissueInvite(student.id()).token();

        assertThat(mvc.get().uri("/api/auth/invites/" + token)).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.purpose").isEqualTo("PASSWORD_RESET");
            assertThat(json).extractingPath("$.login").isEqualTo(student.login());
        });

        assertThat(accept(token, "ignored-login", "brand-new-password")).hasStatusOk();

        assertThat(login(mvc, student.login(), "brand-new-password")).hasStatusOk();
        assertThat(login(mvc, student.login(), student.password())).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(mvc.post().uri("/api/auth/refresh").cookie(oldSession.cookie()))
                .hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void reissuedInvitationReplacesThePreviousOne() {
        StudentAdminService.CreatedStudent created = students.create(Profile.named("Повторно"));

        String newToken = students.reissueInvite(created.student().id()).token();

        assertThat(mvc.get().uri("/api/auth/invites/" + created.invite().token())).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/auth/invites/" + newToken)).hasStatusOk();
    }

    @Test
    void invitationExpires() {
        String token = students.create(Profile.named("Опоздавший")).invite().token();

        clock.advance(Duration.ofDays(8));

        assertThat(mvc.get().uri("/api/auth/invites/" + token))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("invite.invalid");
    }

    private MvcTestResult accept(String token, String login, String password) {
        String json = login == null
                ? "{\"password\":\"%s\"}".formatted(password)
                : "{\"login\":\"%s\",\"password\":\"%s\"}".formatted(login, password);
        return mvc.post().uri("/api/auth/invites/" + token + "/accept")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json)
                .exchange();
    }
}

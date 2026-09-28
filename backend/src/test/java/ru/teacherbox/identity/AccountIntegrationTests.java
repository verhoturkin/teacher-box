package ru.teacherbox.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.identity.IdentityTestSupport.activeStudent;
import static ru.teacherbox.identity.IdentityTestSupport.login;
import static ru.teacherbox.identity.IdentityTestSupport.signIn;
import static ru.teacherbox.identity.IdentityTestSupport.tokens;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.identity.IdentityTestSupport.ActiveStudent;
import ru.teacherbox.identity.IdentityTestSupport.Tokens;
import ru.teacherbox.identity.application.InviteService;
import ru.teacherbox.identity.application.StudentAdminService;
import ru.teacherbox.identity.domain.Profile;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.security.PasswordConfirmation;

@IdentityIntegrationTest
class AccountIntegrationTests {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    StudentAdminService students;

    @Autowired
    InviteService invites;

    @Autowired
    UserRepository users;

    @Autowired
    PasswordConfirmation passwords;

    @Test
    void studentSeesOwnAccountWithoutTeacherNote() {
        StudentAdminService.CreatedStudent created = students.create(
                new Profile("Ника", "nika@example.com", "+7 900 000-00-00", "секретная заметка"));
        invites.accept(created.invite().token(), IdentityTestSupport.uniqueLogin("nika"), "nika-password");
        Tokens tokens = tokens(login(mvc, studentLogin(created), "nika-password"));

        assertThat(mvc.get().uri("/api/me").header(HttpHeaders.AUTHORIZATION, tokens.bearer()))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.role").isEqualTo("STUDENT");
                    assertThat(json).extractingPath("$.email").isEqualTo("nika@example.com");
                    assertThat(json).doesNotHavePath("$.note");
                });
    }

    @Test
    void aGeneratedPasswordMustBeChangedAfterSigningIn() {
        User teacher = users.findTeacher().orElseThrow();
        teacher.requirePasswordChange();
        users.update(teacher);

        MvcTestResult signedIn = login(mvc, "teacher", IdentityTestSupport.TEACHER_PASSWORD);
        assertThat(signedIn).hasStatusOk().bodyJson().extractingPath("$.user.passwordChangeRequired").isEqualTo(true);
        Tokens tokens = tokens(signedIn);
        assertThat(mvc.get().uri("/api/me").header(HttpHeaders.AUTHORIZATION, tokens.bearer()))
                .hasStatusOk().bodyJson().extractingPath("$.passwordChangeRequired").isEqualTo(true);

        MvcTestResult changed = changePassword(tokens, IdentityTestSupport.TEACHER_PASSWORD, "temporary-secret-2");
        assertThat(changed).hasStatusOk().bodyJson().extractingPath("$.user.passwordChangeRequired").isEqualTo(false);
        assertThat(changePassword(tokens(changed), "temporary-secret-2", IdentityTestSupport.TEACHER_PASSWORD))
                .hasStatusOk();
        assertThat(users.findTeacher().orElseThrow().passwordChangeRequired()).isFalse();
    }

    @Test
    void thePasswordConfirmsDangerousActions() {
        UUID teacher = users.findTeacher().orElseThrow().id();
        ActiveStudent student = activeStudent(students, invites, "Подтверждает");

        assertThat(passwords.matches(teacher, IdentityTestSupport.TEACHER_PASSWORD)).isTrue();
        assertThat(passwords.matches(teacher, "wrong-password")).isFalse();
        assertThat(passwords.matches(UUID.randomUUID(), IdentityTestSupport.TEACHER_PASSWORD)).isFalse();
        assertThat(passwords.matches(student.id(), student.password())).isTrue();
        students.deactivate(student.id());
        assertThat(passwords.matches(student.id(), student.password())).as("not an active account").isFalse();
    }

    @Test
    void theTeacherChangesTheirName() {
        Tokens teacher = IdentityTestSupport.signInTeacher(mvc);
        String original = users.findTeacher().orElseThrow().profile().displayName();

        assertThat(rename(teacher, "  Мария Ивановна "))
                .hasStatusOk().bodyJson().extractingPath("$.displayName").isEqualTo("Мария Ивановна");
        assertThat(users.findTeacher().orElseThrow().profile().displayName()).isEqualTo("Мария Ивановна");
        assertThat(rename(teacher, " ")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(rename(teacher, "я".repeat(101))).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(rename(teacher, original)).hasStatusOk();

        ActiveStudent student = activeStudent(students, invites, "Хочет стать учителем");
        assertThat(rename(signIn(mvc, student.login(), student.password()), "Учитель"))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void anonymousHasNoAccount() {
        assertThat(mvc.get().uri("/api/me")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void changesPasswordAndKeepsOnlyTheCurrentSession() {
        ActiveStudent student = activeStudent(students, invites, "Меняет пароль");
        Tokens otherDevice = signIn(mvc, student.login(), student.password());
        Tokens current = signIn(mvc, student.login(), student.password());

        assertThat(changePassword(current, "wrong-current", "new-password-1"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("password.wrong-current");
        assertThat(changePassword(current, student.password(), "short"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("password.weak");

        MvcTestResult changed = changePassword(current, student.password(), "new-password-1");

        assertThat(changed).hasStatusOk().bodyJson().extractingPath("$.accessToken").isNotNull();
        Tokens renewed = tokens(changed);
        assertThat(mvc.post().uri("/api/auth/refresh").cookie(renewed.cookie())).hasStatusOk();
        assertThat(mvc.post().uri("/api/auth/refresh").cookie(otherDevice.cookie()))
                .hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(login(mvc, student.login(), "new-password-1")).hasStatusOk();
    }

    private MvcTestResult rename(Tokens tokens, String name) {
        return mvc.put().uri("/api/teacher/profile")
                .header(HttpHeaders.AUTHORIZATION, tokens.bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"%s\"}".formatted(name))
                .exchange();
    }

    private MvcTestResult changePassword(Tokens tokens, String current, String next) {
        return mvc.post().uri("/api/me/password")
                .header(HttpHeaders.AUTHORIZATION, tokens.bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"%s\",\"newPassword\":\"%s\"}".formatted(current, next))
                .exchange();
    }

    private String studentLogin(StudentAdminService.CreatedStudent created) {
        String login = students.get(created.student().id()).login();
        assertThat(login).isNotNull();
        return login;
    }
}

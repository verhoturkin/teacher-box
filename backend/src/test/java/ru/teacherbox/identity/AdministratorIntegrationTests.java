package ru.teacherbox.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.identity.IdentityTestSupport.signIn;
import static ru.teacherbox.identity.IdentityTestSupport.signInTeacher;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import ru.teacherbox.identity.IdentityTestSupport.Tokens;

/** The administrator reaches only the administration area and their own account (ADR-0010). */
@IdentityIntegrationTest
@TestPropertySource(properties = {
        "teacherbox.identity.admin.login=Admin",
        "teacherbox.identity.admin.password=" + AdministratorIntegrationTests.PASSWORD
})
class AdministratorIntegrationTests {

    static final String PASSWORD = "admin-secret-1";

    @Autowired
    MockMvcTester mvc;

    @Test
    void theAdministratorSignsInWithTheConfiguredPassword() {
        assertThat(IdentityTestSupport.login(mvc, "admin", PASSWORD))
                .hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.user.role").isEqualTo("ADMIN");
                    assertThat(json).extractingPath("$.user.displayName").isEqualTo("Администратор");
                });
    }

    @Test
    void theAdministratorSeesOnlyTheAdministrationArea() {
        Tokens admin = signIn(mvc, "admin", PASSWORD);

        assertThat(mvc.get().uri("/api/me").header(HttpHeaders.AUTHORIZATION, admin.bearer()))
                .hasStatusOk()
                .bodyJson().extractingPath("$.role").isEqualTo("ADMIN");
        assertThat(mvc.get().uri("/api/admin/status").header(HttpHeaders.AUTHORIZATION, admin.bearer()))
                .hasStatusOk();
        assertThat(mvc.get().uri("/api/teacher/students").header(HttpHeaders.AUTHORIZATION, admin.bearer()))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/me/notifications").header(HttpHeaders.AUTHORIZATION, admin.bearer()))
                .hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void theTeacherHasNoAdministration() {
        Tokens teacher = signInTeacher(mvc);

        assertThat(mvc.get().uri("/api/admin/status").header(HttpHeaders.AUTHORIZATION, teacher.bearer()))
                .hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson().extractingPath("$.requestId").asString().isNotBlank();
    }

    @Test
    void theAdministratorChangesTheirPassword() {
        Tokens admin = signIn(mvc, "admin", PASSWORD);

        assertThat(mvc.post().uri("/api/me/password").header(HttpHeaders.AUTHORIZATION, admin.bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"%s\",\"newPassword\":\"%s\"}".formatted(PASSWORD, PASSWORD)))
                .hasStatusOk();
    }
}

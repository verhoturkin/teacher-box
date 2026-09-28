package ru.teacherbox.platform.settings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.platform.backup.Restarter;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.shared.security.PasswordConfirmation;
import ru.teacherbox.testing.TestUsers;

/** The administrator changes the settings of the portal and it restarts (ADR-0016). */
@SpringBootTest(properties = "teacherbox.backup.restart=true")
@AutoConfigureMockMvc
class AdminSettingsIntegrationTest {

    private static final UUID ADMIN = UUID.randomUUID();

    @Autowired
    MockMvcTester mvc;

    @Autowired
    PlatformProperties platform;

    @MockitoBean
    Restarter restarter;

    @MockitoBean
    PasswordConfirmation passwords;

    @BeforeEach
    void passwords() {
        when(passwords.matches(any(), anyString())).thenReturn(false);
        when(passwords.matches(ADMIN, "admin-password")).thenReturn(true);
    }

    @AfterEach
    void cleanUp() throws IOException {
        Files.deleteIfExists(platform.dataDir().resolve(SettingsFile.LOCATION));
        clearInvocations(restarter);
    }

    @Test
    void onlyTheAdministratorSeesTheSettingsAndNeverTheSecrets() throws IOException {
        assertThat(mvc.get().uri("/api/admin/settings").with(TestUsers.teacher(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/admin/settings")).hasStatus(HttpStatus.UNAUTHORIZED);

        change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_AI_API_KEY\":\"sk-secret\"}}");

        MvcTestResult settings = mvc.get().uri("/api/admin/settings").with(TestUsers.admin(ADMIN)).exchange();
        assertThat(settings).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.restartEnabled").isEqualTo(true);
            assertThat(json).extractingPath("$.restartNeeded").isEqualTo(true);
            assertThat(json).extractingPath("$.startedAt").isNotNull();
            assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_AI_API_KEY')].set").asArray()
                    .containsExactly(true);
            assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_AI_API_KEY')].source").asArray()
                    .containsExactly("ADMIN");
            assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_HTTP_PORT')].access").asArray()
                    .containsExactly("DOCKER");
            assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_AI_MODEL')].source").asArray()
                    .containsExactly("DEFAULT");
        });
        assertThat(settings.getResponse().getContentAsString()).doesNotContain("sk-secret");
    }

    @Test
    void savesCheckedValuesAndRestarts() throws IOException {
        assertThat(change("{\"password\":\"wrong\",\"values\":{\"TEACHERBOX_AI_MODEL\":\"x\"}}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("password.wrong-current");
        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_NOPE\":\"x\"}}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("settings.unknown");
        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_IDENTITY_TEACHER_PASSWORD\":\"x\"}}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("settings.read-only");
        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_BACKUP_KEEP\":\"много\"}}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.code").isEqualTo("settings.invalid");
                    assertThat(json).extractingPath("$.detail").asString()
                            .contains("TEACHERBOX_BACKUP_KEEP", "нужно целое число");
                });
        assertThat(change("{\"values\":{}}")).hasStatus(HttpStatus.BAD_REQUEST);
        verify(restarter, never()).restartSoon();

        assertThat(change("{\"password\":\"admin-password\",\"values\":"
                + "{\"TEACHERBOX_BACKUP_KEEP\":\" 14 \",\"TEACHERBOX_AI_MODEL\":\"claude-opus-5\"}}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.changed").asArray()
                            .containsExactly("TEACHERBOX_AI_MODEL", "TEACHERBOX_BACKUP_KEEP");
                    assertThat(json).extractingPath("$.restarting").isEqualTo(true);
                });
        verify(restarter).restartSoon();
        assertThat(Files.readString(platform.dataDir().resolve(SettingsFile.LOCATION)))
                .contains("TEACHERBOX_BACKUP_KEEP=14");
        clearInvocations(restarter);

        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_BACKUP_KEEP\":\"14\"}}"))
                .as("nothing changes: no restart")
                .hasStatusOk().bodyJson().extractingPath("$.restarting").isEqualTo(false);
        verify(restarter, never()).restartSoon();

        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_BACKUP_KEEP\":null}}"))
                .hasStatusOk().bodyJson().extractingPath("$.changed").asArray()
                .containsExactly("TEACHERBOX_BACKUP_KEEP");
        assertThat(mvc.get().uri("/api/admin/settings").with(TestUsers.admin(ADMIN))).hasStatusOk().bodyJson()
                .extractingPath("$.settings[?(@.name == 'TEACHERBOX_BACKUP_KEEP')].source").asArray()
                .doesNotContain("ADMIN");
    }

    private MvcTestResult change(String body) {
        return mvc.put().uri("/api/admin/settings").with(TestUsers.admin(ADMIN))
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }
}

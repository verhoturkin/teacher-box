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
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.platform.backup.Restarter;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.shared.security.PasswordConfirmation;
import ru.teacherbox.shared.settings.SettingsChanged;
import ru.teacherbox.testing.TestUsers;

/**
 * The administrator changes the settings of the portal (ADR-0016): live ones are in force at once, the
 * others after a restart; the teacher's settings are not theirs (ADR-0056).
 */
@SpringBootTest(properties = "teacherbox.backup.restart=true")
@AutoConfigureMockMvc
@RecordApplicationEvents
class AdminSettingsIntegrationTest {

    private static final UUID ADMIN = UUID.randomUUID();

    @Autowired
    MockMvcTester mvc;

    @Autowired
    PlatformProperties platform;

    @Autowired
    AdminSettingsService service;

    @Autowired
    Environment environment;

    @Autowired
    ApplicationEvents events;

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
        // back to .env, live values included: the context is shared with other tests
        Map<String, @Nullable String> none = new HashMap<>();
        SettingsCatalog.all().stream().filter(SettingDefinition::editable).forEach(setting -> none.put(setting.name(), null));
        service.change(ADMIN, "admin-password", none);
        Files.deleteIfExists(platform.dataDir().resolve(SettingsFile.LOCATION));
        clearInvocations(restarter);
    }

    @Test
    void onlyTheAdministratorSeesTheSettingsAndNeverTheSecrets() throws IOException {
        assertThat(mvc.get().uri("/api/admin/settings").with(TestUsers.teacher(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/admin/settings")).hasStatus(HttpStatus.UNAUTHORIZED);

        // saved here before the secret became read-only (ADR-0056): it stays in force, never shown
        new SettingsFile(platform.dataDir()).write(
                Map.of("TEACHERBOX_SECURITY_JWT_SECRET", "sk-secret-of-32-characters-at-least"));

        MvcTestResult settings = mvc.get().uri("/api/admin/settings").with(TestUsers.admin(ADMIN)).exchange();
        assertThat(settings).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.restartEnabled").isEqualTo(true);
            assertThat(json).extractingPath("$.restartNeeded").isEqualTo(true);
            assertThat(json).extractingPath("$.startedAt").isNotNull();
            assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_SECURITY_JWT_SECRET')].set")
                    .asArray().containsExactly(true);
            assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_SECURITY_JWT_SECRET')].source")
                    .asArray().containsExactly("ADMIN");
            assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_HTTP_PORT')].access").asArray()
                    .containsExactly("DOCKER");
            assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_HTTP_PORT')].owner").asArray()
                    .containsExactly("ENV_ONLY");
            assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_SECURITY_JWT_SECRET')].access")
                    .asArray().containsExactly("ENV");
            assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_SECURITY_JWT_SECRET')].owner")
                    .asArray().containsExactly("ENV_ONLY");
            assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_AI_PROXY')].source").asArray()
                    .containsExactly("DEFAULT");
            assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS')].live")
                    .asArray().containsExactly(true);
            assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_AI_PROXY')].live").asArray()
                    .containsExactly(true);
        });
        assertThat(settings.getResponse().getContentAsString()).doesNotContain("sk-secret");
        assertThat(settings).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_TIMEZONE')]").asArray().isEmpty();
            assertThat(json).extractingPath("$.settings[?(@.owner == 'TEACHER')]").asArray().isEmpty();
        });
    }

    @Test
    void theTeachersSettingsAreNotTheAdministrators() throws IOException {
        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_AI_MODEL\":\"x\"}}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("settings.teacher");
        assertThat(mvc.get().uri("/api/admin/settings").with(TestUsers.admin(ADMIN))).hasStatusOk().bodyJson()
                .extractingPath("$.moved[?(@.name == 'TEACHERBOX_AI_MODEL')]").asArray().isEmpty();

        // a value saved here before the teacher's settings moved into the portal (ADR-0056)
        new SettingsFile(platform.dataDir()).write(Map.of("TEACHERBOX_AI_MODEL", "claude-opus-5"));

        MvcTestResult settings = mvc.get().uri("/api/admin/settings").with(TestUsers.admin(ADMIN)).exchange();
        assertThat(settings).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.moved[?(@.name == 'TEACHERBOX_AI_MODEL')].source").asArray()
                    .containsExactly("ADMIN");
            assertThat(json).extractingPath("$.moved[?(@.name == 'TEACHERBOX_AI_MODEL')].title").asArray()
                    .containsExactly("Модель");
        });
        assertThat(settings.getResponse().getContentAsString()).doesNotContain("claude-opus-5");

        // the administrator's change keeps it for the teacher's settings to import
        change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_BACKUP_KEEP_DAYS\":\"9\"}}");
        assertThat(new SettingsFile(platform.dataDir()).read()).containsEntry("TEACHERBOX_AI_MODEL", "claude-opus-5");
    }

    @Test
    void aLiveValueIsInForceWithoutARestart() {
        assertThat(mvc.put().uri("/api/admin/settings").with(TestUsers.teacher(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"x\",\"values\":{\"TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS\":\"3\"}}"))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(maxAttempts()).isEqualTo(8);

        assertThat(change("{\"password\":\"admin-password\",\"values\":{"
                + "\"TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS\":\"3\",\"TEACHERBOX_NOTIFICATIONS_LINK_CODE_TTL\":\"30m\"}}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.applied").asArray().containsExactly(
                            "TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS", "TEACHERBOX_NOTIFICATIONS_LINK_CODE_TTL");
                    assertThat(json).extractingPath("$.restarting").isEqualTo(false);
                });
        verify(restarter, never()).restartSoon();
        assertThat(maxAttempts()).isEqualTo(3);
        assertThat(Binder.get(environment).bind("teacherbox.notifications.link-code-ttl", Duration.class).get())
                .isEqualTo(Duration.ofMinutes(30));
        assertThat(events.stream(SettingsChanged.class)).singleElement()
                .satisfies(event -> assertThat(event.names()).containsExactlyInAnyOrder(
                        "TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS", "TEACHERBOX_NOTIFICATIONS_LINK_CODE_TTL"));
        assertThat(mvc.get().uri("/api/admin/settings").with(TestUsers.admin(ADMIN))).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.restartNeeded").isEqualTo(false);
                    assertThat(json)
                            .extractingPath("$.settings[?(@.name == 'TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS')].value")
                            .asArray().containsExactly("3");
                });

        // a live and a restart setting together: the live one at once, a restart for the other — every editable
        // setting is live (ADR-0056), so the other one is a value only .env keeps now, saved before and removed
        SettingsFile file = new SettingsFile(platform.dataDir());
        Map<String, String> saved = new java.util.HashMap<>(file.read());
        saved.put("LOGGING_LOGBACK_ROLLINGPOLICY_MAX_HISTORY", "9");
        file.write(saved);
        assertThat(change("{\"password\":\"admin-password\",\"values\":{"
                + "\"TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS\":null,\"LOGGING_LOGBACK_ROLLINGPOLICY_MAX_HISTORY\":null}}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.applied").asArray()
                            .containsExactly("TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS");
                    assertThat(json).extractingPath("$.restarting").isEqualTo(true);
                });
        verify(restarter).restartSoon();
        assertThat(maxAttempts()).as("back to .env and the default").isEqualTo(8);
    }

    private int maxAttempts() {
        return Binder.get(environment).bind("teacherbox.notifications.max-attempts", Integer.class).orElse(8);
    }

    @Test
    void theCatalogIsInTheLanguageOfThePage() {
        assertThat(mvc.get().uri("/api/admin/settings").header(HttpHeaders.ACCEPT_LANGUAGE, "en")
                .with(TestUsers.admin(ADMIN)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_AI_PROXY')].title").asArray()
                            .containsExactly("Default proxy");
                    assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_AI_PROXY')].group").asArray()
                            .containsExactly("AI assistant");
                });
        assertThat(mvc.put().uri("/api/admin/settings").header(HttpHeaders.ACCEPT_LANGUAGE, "en-GB,en;q=0.9")
                .with(TestUsers.admin(ADMIN)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_BACKUP_KEEP_DAYS\":\"many\"}}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.detail").asString()
                .isEqualTo("Days to keep backups (TEACHERBOX_BACKUP_KEEP_DAYS): Enter a whole number");
    }

    @Test
    void savesCheckedValuesAndRestarts() throws IOException {
        assertThat(change("{\"password\":\"wrong\",\"values\":{\"TEACHERBOX_AI_PROXY\":\"x\"}}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("password.wrong-current");
        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_NOPE\":\"x\"}}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("settings.unknown");
        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_IDENTITY_TEACHER_PASSWORD\":\"x\"}}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("settings.read-only");
        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_BACKUP_KEEP_DAYS\":\"много\"}}"))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.code").isEqualTo("settings.invalid");
                    assertThat(json).extractingPath("$.detail").asString()
                            .contains("TEACHERBOX_BACKUP_KEEP_DAYS", "нужно целое число");
                });
        assertThat(change("{\"values\":{}}")).hasStatus(HttpStatus.BAD_REQUEST);
        verify(restarter, never()).restartSoon();

        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"LOGGING_LOGBACK_ROLLINGPOLICY_MAX_HISTORY\":\"14\"}}"))
                .as("only in .env (ADR-0056)")
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("settings.read-only");
        verify(restarter, never()).restartSoon();

        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_AI_PROXY\":\" http://proxy:3128 \"}}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.changed").asArray()
                            .containsExactly("TEACHERBOX_AI_PROXY");
                    assertThat(json).extractingPath("$.applied").asArray().containsExactly("TEACHERBOX_AI_PROXY");
                    assertThat(json).extractingPath("$.restarting").isEqualTo(false);
                });
        verify(restarter, never()).restartSoon();
        assertThat(environment.getProperty("teacherbox.ai.proxy")).as("live (ADR-0057)").isEqualTo("http://proxy:3128");
        assertThat(Files.readString(platform.dataDir().resolve(SettingsFile.LOCATION)))
                .contains("TEACHERBOX_AI_PROXY=http\\://proxy\\:3128");

        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_AI_PROXY\":\"http://proxy:3128\"}}"))
                .as("nothing changes: no restart")
                .hasStatusOk().bodyJson().extractingPath("$.restarting").isEqualTo(false);
        verify(restarter, never()).restartSoon();

        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_AI_PROXY\":null}}"))
                .hasStatusOk().bodyJson().extractingPath("$.changed").asArray()
                .containsExactly("TEACHERBOX_AI_PROXY");
        assertThat(mvc.get().uri("/api/admin/settings").with(TestUsers.admin(ADMIN))).hasStatusOk().bodyJson()
                .extractingPath("$.settings[?(@.name == 'TEACHERBOX_AI_PROXY')].source").asArray()
                .doesNotContain("ADMIN");
    }

    @Test
    void aReadOnlyValueSavedBeforeIsOnlyRemoved() {
        // saved here while the log settings were still the administrator's (before ADR-0056)
        new SettingsFile(platform.dataDir()).write(Map.of("LOGGING_LOGBACK_ROLLINGPOLICY_MAX_HISTORY", "9"));
        assertThat(mvc.get().uri("/api/admin/settings").with(TestUsers.admin(ADMIN))).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json)
                            .extractingPath("$.settings[?(@.name == 'LOGGING_LOGBACK_ROLLINGPOLICY_MAX_HISTORY')].source")
                            .asArray().containsExactly("ADMIN");
                    assertThat(json)
                            .extractingPath("$.settings[?(@.name == 'LOGGING_LOGBACK_ROLLINGPOLICY_MAX_HISTORY')].value")
                            .asArray().containsExactly("9");
                });
        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"TEACHERBOX_HTTP_PORT\":null}}"))
                .as("Docker reads it, the file never holds it")
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("settings.read-only");

        assertThat(change("{\"password\":\"admin-password\",\"values\":{\"LOGGING_LOGBACK_ROLLINGPOLICY_MAX_HISTORY\":null}}"))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.changed").asArray()
                            .containsExactly("LOGGING_LOGBACK_ROLLINGPOLICY_MAX_HISTORY");
                    assertThat(json).extractingPath("$.restarting").isEqualTo(true);
                });
        verify(restarter).restartSoon();
        assertThat(new SettingsFile(platform.dataDir()).read()).isEmpty();
    }

    private MvcTestResult change(String body) {
        return mvc.put().uri("/api/admin/settings").with(TestUsers.admin(ADMIN))
                .contentType(MediaType.APPLICATION_JSON).content(body).exchange();
    }
}

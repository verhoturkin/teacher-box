package ru.teacherbox.platform.settings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.platform.backup.BackupProperties;
import ru.teacherbox.platform.backup.Restarter;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.shared.security.PasswordConfirmation;
import ru.teacherbox.shared.settings.LiveProperties;
import ru.teacherbox.shared.time.ZonedJob;
import ru.teacherbox.testing.TestUsers;

/**
 * The administrator's settings of 363.6 are in force without a restart (ADR-0056): upload limits, session
 * lifetimes, the sign-in rate limit, backup schedules and retention.
 */
@SpringBootTest(properties = "teacherbox.identity.teacher.password=" + LiveAdminSettingsIntegrationTest.TEACHER_PASSWORD)
@AutoConfigureMockMvc
@Import(LiveAdminSettingsIntegrationTest.StableTime.class)
class LiveAdminSettingsIntegrationTest {

    @TestConfiguration(proxyBeanMethods = false)
    static class StableTime {
        @Bean
        Clock clock() {
            // Token creation and the response must see the same second, even on slow CI runners.
            return Clock.fixed(Instant.now(), ZoneOffset.UTC);
        }
    }

    static final String TEACHER_PASSWORD = "teacher-secret-1";
    private static final UUID ADMIN = UUID.randomUUID();

    @Autowired
    MockMvcTester mvc;

    @Autowired
    AdminSettingsService service;

    @Autowired
    PlatformProperties platform;

    @Autowired
    Environment environment;

    @Autowired
    List<ZonedJob> jobs;

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
        Map<String, @Nullable String> none = new HashMap<>();
        SettingsCatalog.all().stream().filter(SettingDefinition::editable).forEach(setting -> none.put(setting.name(), null));
        service.change(ADMIN, "admin-password", none);
        Files.deleteIfExists(platform.dataDir().resolve(SettingsFile.LOCATION));
    }

    @Test
    void uploadLimitsApplyToTheNextUploadAndAreBoundedByTheRequestCeiling() {
        UUID teacher = UUID.randomUUID();
        assertThat(mvc.get().uri("/api/me/homework/limits").with(TestUsers.teacher(teacher))).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.maxFileSize").isEqualTo(20 * 1024 * 1024);
                    assertThat(json).extractingPath("$.maxFilesPerUpload").isEqualTo(10);
                });

        change(Map.of("TEACHERBOX_HOMEWORK_MAX_FILE_SIZE", "5MB", "TEACHERBOX_HOMEWORK_MAX_FILES_PER_UPLOAD", "3"));
        assertThat(mvc.get().uri("/api/me/homework/limits").with(TestUsers.teacher(teacher))).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.maxFileSize").isEqualTo(5 * 1024 * 1024);
                    assertThat(json).extractingPath("$.maxFilesPerUpload").isEqualTo(3);
                });

        change(Map.of("TEACHERBOX_HOMEWORK_MAX_FILE_SIZE", "40MB"));
        assertThat(mvc.get().uri("/api/me/homework/limits").with(TestUsers.teacher(teacher))).hasStatusOk().bodyJson()
                .extractingPath("$.maxFileSize").isEqualTo(25 * 1024 * 1024);
        verify(restarter, never()).restartSoon();
    }

    @Test
    void theNextSignInTakesTheNewLifetimeAndTheRateLimit() {
        assertThat(signIn()).hasStatusOk().bodyJson().extractingPath("$.expiresIn").isEqualTo(900);

        change(Map.of("TEACHERBOX_IDENTITY_ACCESS_TOKEN_TTL", "5m", "TEACHERBOX_IDENTITY_REFRESH_TOKEN_TTL", "2d"));
        MvcTestResult signedIn = signIn();
        assertThat(signedIn).hasStatusOk().bodyJson().extractingPath("$.expiresIn").isEqualTo(300);
        assertThat(signedIn.getResponse().getCookie("tb_refresh")).isNotNull()
                .satisfies(cookie -> assertThat(cookie.getMaxAge())
                        .isBetween((int) Duration.ofDays(2).toSeconds() - 5, (int) Duration.ofDays(2).toSeconds()));

        change(Map.of("TEACHERBOX_SECURITY_AUTH_RATE_LIMIT_REQUESTS", "1",
                "TEACHERBOX_SECURITY_AUTH_RATE_LIMIT_PERIOD", "10m"));
        assertThat(signIn()).hasStatusOk();
        MvcTestResult limited = signIn();
        assertThat(limited).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(Long.parseLong(limited.getResponse().getHeader("Retry-After"))).as("the new period")
                .isBetween(590L, 600L);
        verify(restarter, never()).restartSoon();
    }

    @Test
    void backupSchedulesShowAsOnOffAndATimeAndApplyAtOnce() {
        // the catalog shows an unset schedule by the jobs' own defaults
        assertThat(jobs).filteredOn(job -> SettingsCatalog.find(job.cronSetting()).isPresent())
                .extracting(ZonedJob::cronSetting)
                .containsExactlyInAnyOrderElementsOf(SettingsCatalog.DEFAULT_CRONS.keySet());
        jobs.stream().filter(job -> SettingsCatalog.DEFAULT_CRONS.containsKey(job.cronSetting()))
                .forEach(job -> assertThat(SettingsCatalog.defaultCron(job.cronSetting())).contains(job.defaultCron()));

        assertThat(mvc.get().uri("/api/admin/settings").with(TestUsers.admin(ADMIN))).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_BACKUP_CRON')].schedule.enabled")
                            .asArray().containsExactly(true);
                    assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_BACKUP_CRON')].schedule.time")
                            .asArray().containsExactly("03:30");
                    assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_BOARDS_BACKUP_CRON')].schedule.time")
                            .asArray().containsExactly("03:00");
                    assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_BACKUP_KEEP_DAYS')].schedule")
                            .asArray().containsExactly((Object) null);
                });

        change(Map.of("TEACHERBOX_BACKUP_CRON", DailySchedule.off().cron(),
                "TEACHERBOX_BOARDS_BACKUP_CRON", "0 */5 * * * *", "TEACHERBOX_BACKUP_KEEP_DAYS", "3"));
        assertThat(environment.getProperty("teacherbox.backup.cron")).isEqualTo("-");
        assertThat(environment.getProperty("teacherbox.boards.backup-cron")).isEqualTo("0 */5 * * * *");
        assertThat(new LiveProperties<>(environment, BackupProperties.class).get().retention())
                .isEqualTo(Duration.ofDays(3));
        assertThat(mvc.get().uri("/api/admin/settings").with(TestUsers.admin(ADMIN))).hasStatusOk().bodyJson()
                .satisfies(json -> {
                    assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_BACKUP_CRON')].schedule.enabled")
                            .asArray().containsExactly(false);
                    assertThat(json).extractingPath("$.settings[?(@.name == 'TEACHERBOX_BOARDS_BACKUP_CRON')].schedule")
                            .asArray().containsExactly((Object) null);
                    assertThat(json).extractingPath("$.restartNeeded").isEqualTo(false);
                });
        verify(restarter, never()).restartSoon();
    }

    @Test
    void theOtherLiveSettingsAreBoundAnew() {
        change(Map.of("TEACHERBOX_NOTIFICATIONS_WEBPUSH_SUBJECT", "mailto:admin@example.com",
                "TEACHERBOX_IDENTITY_INVITE_TTL", "3d", "TEACHERBOX_IDENTITY_MAX_FAILED_LOGINS", "2",
                "TEACHERBOX_IDENTITY_LOCK_DURATION", "1h", "TEACHERBOX_HOMEWORK_YOUTUBE_PROXY", "socks5://127.0.0.1:1080"));
        Binder binder = Binder.get(environment);
        assertThat(binder.bind("teacherbox.notifications.webpush.subject", String.class).get())
                .isEqualTo("mailto:admin@example.com");
        assertThat(binder.bind("teacherbox.identity.invite-ttl", Duration.class).get()).isEqualTo(Duration.ofDays(3));
        assertThat(binder.bind("teacherbox.identity.max-failed-logins", Integer.class).get()).isEqualTo(2);
        assertThat(binder.bind("teacherbox.identity.lock-duration", Duration.class).get()).isEqualTo(Duration.ofHours(1));
        assertThat(binder.bind("teacherbox.homework.youtube-proxy", String.class).get())
                .isEqualTo("socks5://127.0.0.1:1080");
        verify(restarter, never()).restartSoon();
    }

    private void change(Map<String, @Nullable String> values) {
        AdminSettingsService.Changed changed = service.change(ADMIN, "admin-password", values);
        assertThat(changed.applied()).containsExactlyInAnyOrderElementsOf(values.keySet());
        assertThat(changed.restarting()).isFalse();
    }

    private MvcTestResult signIn() {
        return mvc.post().uri("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"teacher\",\"password\":\"%s\"}".formatted(TEACHER_PASSWORD)).exchange();
    }
}

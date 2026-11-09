package ru.teacherbox.platform.settings;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.teacherbox.platform.backup.drive.DriveConnectionStore;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.platform.settings.SettingDefinition.Owner;
import ru.teacherbox.shared.settings.TeacherSettingsImport;

/**
 * An upgraded instance takes the teacher's values saved in the administrator's settings file (or in
 * {@code .env}) into the modules once (ADR-0056).
 */
@SpringBootTest
class EnvImportIntegrationTest {

    /** Taken by the version that adds their module's import: AI providers (364.1), the name (363.5). */
    private static final Set<String> LATER = Set.of("TEACHERBOX_AI_PROVIDER", "TEACHERBOX_AI_API_KEY",
            "TEACHERBOX_AI_MODEL", "TEACHERBOX_AI_BASE_URL", "TEACHERBOX_AI_MONTHLY_TOKEN_LIMIT", "TEACHERBOX_AI_EFFORT",
            "TEACHERBOX_AI_FALLBACKS", "TEACHERBOX_AI_MAX_TOKENS", "TEACHERBOX_AI_TIMEOUT",
            "TEACHERBOX_IDENTITY_TEACHER_NAME");

    @Autowired
    EnvImport envImport;

    @Autowired
    List<TeacherSettingsImport> imports;

    @Autowired
    PlatformProperties platform;

    @Autowired
    DriveConnectionStore drive;

    @Autowired
    JdbcClient jdbc;

    @AfterEach
    void cleanUp() throws IOException {
        Files.deleteIfExists(platform.dataDir().resolve(SettingsFile.LOCATION));
        Files.deleteIfExists(platform.dataDir().resolve("google-drive.json"));
        jdbc.sql("update platform.portal_settings set address = null, time_zone = null where id = 1").update();
        jdbc.sql("update billing.settings set currency = null where id = 1").update();
        jdbc.sql("delete from schedule.settings").update();
        jdbc.sql("delete from homework.settings").update();
        jdbc.sql("delete from notifications.channel_settings").update();
    }

    @Test
    void everyTeachersSettingIsTakenByOneModule() {
        List<String> names = imports.stream().flatMap(module -> module.names().stream()).toList();
        Set<String> teachers = new TreeSet<>();
        SettingsCatalog.all().stream().filter(setting -> setting.owner() == Owner.TEACHER)
                .map(SettingDefinition::name).forEach(teachers::add);
        teachers.removeAll(LATER);

        assertThat(names).doesNotHaveDuplicates().containsExactlyInAnyOrderElementsOf(teachers);
    }

    @Test
    void aNewInstanceStartsWithNothingToImportAndNeverReadsTheVariablesAgain() {
        assertThat(envImport.read().keySet()).containsExactlyInAnyOrderElementsOf(
                imports.stream().flatMap(module -> module.names().stream()).toList());
    }

    @Test
    void anUpgradedInstanceKeepsItsValuesAndTheNextStartIgnoresChangedOnes() throws IOException {
        // the version before the import: nothing was imported
        Files.delete(platform.dataDir().resolve(EnvImport.LOCATION));
        SettingsFile file = new SettingsFile(platform.dataDir());
        file.write(Map.of("TEACHERBOX_PUBLIC_URL", "https://school.example.com",
                "TEACHERBOX_TIMEZONE", "Asia/Yekaterinburg",
                "TEACHERBOX_BILLING_CURRENCY", "EUR",
                "TEACHERBOX_SCHEDULE_REMINDERS", "2h",
                "TEACHERBOX_HOMEWORK_DUE_SOON_WINDOW", "12h",
                "TEACHERBOX_NOTIFICATIONS_MAX_TOKEN", "max-token",
                "TEACHERBOX_BACKUP_GOOGLE_CLIENT_ID", "drive-client",
                "TEACHERBOX_BACKUP_GOOGLE_CLIENT_SECRET", "drive-secret"));

        envImport.run();

        assertImported();

        file.write(Map.of("TEACHERBOX_TIMEZONE", "Europe/Kaliningrad", "TEACHERBOX_SCHEDULE_REMINDERS", "3h"));
        jdbc.sql("update platform.portal_settings set time_zone = null where id = 1").update();
        jdbc.sql("delete from schedule.settings").update();
        envImport.run();

        assertThat(text("select time_zone from platform.portal_settings")).isNull();
        assertThat(jdbc.sql("select count(*) from schedule.settings").query(Long.class).single()).isZero();
    }

    private void assertImported() {
        assertThat(text("select address from platform.portal_settings")).isEqualTo("https://school.example.com");
        assertThat(text("select time_zone from platform.portal_settings")).isEqualTo("Asia/Yekaterinburg");
        assertThat(text("select currency from billing.settings")).isEqualTo("EUR");
        assertThat(text("select reminders from schedule.settings")).isEqualTo("PT2H");
        assertThat(text("select due_soon_window from homework.settings")).isEqualTo("PT12H");
        assertThat(text("select token from notifications.channel_settings where channel = 'MAX'"))
                .isEqualTo("max-token");
        assertThat(drive.load().clientId()).isEqualTo("drive-client");
        assertThat(drive.load().clientSecret()).isEqualTo("drive-secret");
    }

    private @Nullable String text(String sql) {
        return jdbc.sql(sql).query((rs, row) -> rs.getString(1)).list().getFirst();
    }
}

package ru.teacherbox.homework;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.teacherbox.homework.application.HomeworkSettingsImport;
import ru.teacherbox.homework.persistence.HomeworkSettingsRepository;
import ru.teacherbox.homework.persistence.HomeworkSettingsRepository.Setting;
import ru.teacherbox.shared.settings.OldSettings;

/** The reminder before the due date of an upgraded instance comes from {@code .env} once (ADR-0056). */
@HomeworkIntegrationTest
class SettingsImportIntegrationTests {

    private static final String WINDOW = "TEACHERBOX_HOMEWORK_DUE_SOON_WINDOW";

    @Autowired
    HomeworkSettingsImport settingsImport;

    @Autowired
    HomeworkSettingsRepository settings;

    @Autowired
    JdbcClient jdbc;

    @AfterEach
    void noSettings() {
        jdbc.sql("delete from homework.settings").update();
    }

    @Test
    void anUpgradedInstanceKeepsItsWindowAndASecondImportChangesNothing() {
        assertThat(settings.find(Setting.DUE_SOON_WINDOW)).isEmpty();

        assertThat(settingsImport.importFrom(new OldSettings(Map.of(WINDOW, "48h")))).containsExactly(WINDOW);
        assertThat(settings.find(Setting.DUE_SOON_WINDOW)).contains("PT48H");

        assertThat(settingsImport.importFrom(new OldSettings(Map.of(WINDOW, "12h")))).isEmpty();
        assertThat(settings.find(Setting.DUE_SOON_WINDOW)).contains("PT48H");
    }

    @Test
    void anInvalidWindowIsNotImported() {
        assertThat(settingsImport.importFrom(new OldSettings(Map.of(WINDOW, "0s")))).isEmpty();
        assertThat(settingsImport.importFrom(new OldSettings(Map.of(WINDOW, "завтра")))).isEmpty();
        assertThat(settings.find(Setting.DUE_SOON_WINDOW)).isEmpty();
    }
}

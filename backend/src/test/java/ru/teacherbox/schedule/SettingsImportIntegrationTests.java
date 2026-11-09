package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.teacherbox.schedule.application.ScheduleSettingsImport;
import ru.teacherbox.schedule.domain.GoogleConnection;
import ru.teacherbox.schedule.persistence.GoogleRepository;
import ru.teacherbox.schedule.persistence.ScheduleSettingsRepository;
import ru.teacherbox.schedule.persistence.ScheduleSettingsRepository.Setting;
import ru.teacherbox.shared.settings.OldSettings;

/** The lesson rules and the Google client of an upgraded instance come from {@code .env} once (ADR-0056). */
@ScheduleIntegrationTest
class SettingsImportIntegrationTests {

    private static final String DURATION = "TEACHERBOX_SCHEDULE_DEFAULT_DURATION";
    private static final String BILLING_DURATION = "TEACHERBOX_BILLING_DEFAULT_LESSON_DURATION";
    private static final String LATE = "TEACHERBOX_SCHEDULE_LATE_CANCELLATION";
    private static final String REMINDERS = "TEACHERBOX_SCHEDULE_REMINDERS";
    private static final String HORIZON = "TEACHERBOX_SCHEDULE_HORIZON";
    private static final String CLIENT_ID = "TEACHERBOX_SCHEDULE_GOOGLE_CLIENT_ID";
    private static final String CLIENT_SECRET = "TEACHERBOX_SCHEDULE_GOOGLE_CLIENT_SECRET";

    @Autowired
    ScheduleSettingsImport settingsImport;

    @Autowired
    ScheduleSettingsRepository settings;

    @Autowired
    GoogleRepository google;

    @Autowired
    JdbcClient jdbc;

    @AfterEach
    void noSettings() {
        jdbc.sql("delete from schedule.settings").update();
        jdbc.sql("delete from schedule.google_connection").update();
    }

    @Test
    void anUpgradedInstanceKeepsItsRulesAndASecondImportChangesNothing() {
        OldSettings old = new OldSettings(Map.of(DURATION, "45", BILLING_DURATION, "90", LATE, "12h",
                REMINDERS, "1h, 24h, 1h", HORIZON, "28d", CLIENT_ID, "client", CLIENT_SECRET, "secret"));

        assertThat(settingsImport.importFrom(old))
                .containsExactlyInAnyOrder(DURATION, LATE, REMINDERS, HORIZON, CLIENT_ID, CLIENT_SECRET);

        assertThat(settings.find(Setting.DEFAULT_DURATION)).contains("45");
        assertThat(settings.find(Setting.LATE_CANCELLATION)).contains("PT12H");
        assertThat(settings.find(Setting.REMINDERS)).contains("PT1H,PT24H");
        assertThat(settings.find(Setting.HORIZON)).contains("PT672H");
        assertThat(google.connection()).hasValueSatisfying(connection -> {
            assertThat(connection.clientId()).isEqualTo("client");
            assertThat(connection.clientSecret()).isEqualTo("secret");
        });

        OldSettings changed = new OldSettings(Map.of(DURATION, "30", LATE, "1h", REMINDERS, "", HORIZON, "56d",
                CLIENT_ID, "other", CLIENT_SECRET, "other"));
        assertThat(settingsImport.importFrom(changed)).isEmpty();
        assertThat(settings.find(Setting.DEFAULT_DURATION)).contains("45");
        assertThat(settings.find(Setting.REMINDERS)).contains("PT1H,PT24H");
        assertThat(google.connection()).hasValueSatisfying(
                connection -> assertThat(connection.clientId()).isEqualTo("client"));
    }

    @Test
    void theBillingLengthIsTakenWhenOnlyItIsSetAndEmptyRemindersMeanNone() {
        OldSettings old = new OldSettings(Map.of(BILLING_DURATION, "90", REMINDERS, "", CLIENT_ID, "client"));

        assertThat(settingsImport.importFrom(old)).containsExactlyInAnyOrder(BILLING_DURATION, REMINDERS);

        assertThat(settings.find(Setting.DEFAULT_DURATION)).contains("90");
        assertThat(settings.find(Setting.REMINDERS)).contains("");
        assertThat(settings.find(Setting.HORIZON)).isEmpty();
        assertThat(google.connection()).isEmpty();
    }

    @Test
    void valuesOutsideTheOldLimitsAreNotImported() {
        OldSettings old = new OldSettings(Map.of(DURATION, "601", BILLING_DURATION, "0", LATE, "-1h",
                REMINDERS, "1h,0s", HORIZON, "6d"));

        assertThat(settingsImport.importFrom(old)).isEmpty();
        assertThat(settings.find(Setting.DEFAULT_DURATION)).isEmpty();
    }

    @Test
    void aClientTheTeacherEnteredStays() {
        google.save(GoogleConnection.none(Instant.now()).withClient("own", "own-secret", Instant.now()));

        assertThat(settingsImport.importFrom(new OldSettings(Map.of(CLIENT_ID, "client", CLIENT_SECRET, "secret"))))
                .isEmpty();
        assertThat(google.connection()).hasValueSatisfying(
                connection -> assertThat(connection.clientId()).isEqualTo("own"));
    }
}

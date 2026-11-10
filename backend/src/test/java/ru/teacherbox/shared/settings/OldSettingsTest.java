package ru.teacherbox.shared.settings;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Currency;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The old values of the teacher's settings are read as Spring Boot read the variables (ADR-0056). */
class OldSettingsTest {

    private final OldSettings values = new OldSettings(Map.of(
            "TEACHERBOX_SCHEDULE_REMINDERS", " 24h, 1h ",
            "TEACHERBOX_HOMEWORK_DUE_SOON_WINDOW", "48h",
            "TEACHERBOX_BILLING_CURRENCY", "EUR",
            "TEACHERBOX_SCHEDULE_HORIZON", "",
            "TEACHERBOX_SCHEDULE_DEFAULT_DURATION", "долго"));

    @Test
    void readsTheValuesAsTheVariablesWereRead() {
        assertThat(values.list("TEACHERBOX_SCHEDULE_REMINDERS", Duration.class))
                .contains(List.of(Duration.ofHours(24), Duration.ofHours(1)));
        assertThat(values.value("TEACHERBOX_HOMEWORK_DUE_SOON_WINDOW", Duration.class)).contains(Duration.ofHours(48));
        assertThat(values.value("TEACHERBOX_BILLING_CURRENCY", Currency.class)).contains(Currency.getInstance("EUR"));
        assertThat(values.text("TEACHERBOX_BILLING_CURRENCY")).contains("EUR");
    }

    @Test
    void anEmptyValueIsSetButHasNoValue() {
        assertThat(values.blank("TEACHERBOX_SCHEDULE_HORIZON")).isTrue();
        assertThat(values.text("TEACHERBOX_SCHEDULE_HORIZON")).isEmpty();
        assertThat(values.value("TEACHERBOX_SCHEDULE_HORIZON", Duration.class)).isEmpty();
        assertThat(values.blank("TEACHERBOX_BILLING_CURRENCY")).isFalse();
        assertThat(values.blank("TEACHERBOX_TIMEZONE")).isFalse();
    }

    @Test
    void aMissingOrUnreadableValueIsLeftOut() {
        assertThat(values.value("TEACHERBOX_TIMEZONE", String.class)).isEmpty();
        assertThat(values.text("TEACHERBOX_TIMEZONE")).isEmpty();
        assertThat(values.value("TEACHERBOX_SCHEDULE_DEFAULT_DURATION", Integer.class)).isEmpty();
    }
}

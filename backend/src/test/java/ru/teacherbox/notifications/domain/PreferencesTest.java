package ru.teacherbox.notifications.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Set;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;

class PreferencesTest {

    private static final ZoneId MOSCOW = ZoneId.of("Europe/Moscow");

    @Test
    void everyKindHasATopic() {
        for (NotificationKind kind : NotificationKind.values()) {
            assertThat(NotificationTopic.of(kind)).as(kind.name()).isNotNull();
        }
        assertThat(NotificationTopic.of(NotificationKind.HOMEWORK_DUE_SOON)).isEqualTo(NotificationTopic.REMINDERS);
        assertThat(NotificationTopic.of(NotificationKind.SCHEDULE_REQUEST)).isEqualTo(NotificationTopic.SCHEDULE);
        assertThat(NotificationTopic.of(NotificationKind.PAYMENT_RECORDED)).isEqualTo(NotificationTopic.BILLING);
        assertThat(NotificationTopic.of(NotificationKind.MESSAGE)).isEqualTo(NotificationTopic.MESSAGES);
    }

    @Test
    void mutedTopicsAreNotSentButTeacherMessagesAlwaysAre() {
        Preferences preferences = new Preferences(Set.of(NotificationTopic.BILLING, NotificationTopic.MESSAGES),
                null, null);

        assertThat(preferences.mutedTopics()).containsExactly(NotificationTopic.BILLING);
        assertThat(preferences.sendsToMessengers(NotificationKind.PAYMENT_RECORDED)).isFalse();
        assertThat(preferences.sendsToMessengers(NotificationKind.MESSAGE)).isTrue();
        assertThat(Preferences.DEFAULT.sendsToMessengers(NotificationKind.PAYMENT_RECORDED)).isTrue();
    }

    @Test
    void overnightQuietHoursDelayUntilMorning() {
        Preferences quiet = new Preferences(Set.of(), LocalTime.of(22, 0), LocalTime.of(8, 0));

        assertThat(quiet.deliverAt(Instant.parse("2026-10-01T20:30:00Z"), MOSCOW))
                .as("23:30 Moscow").isEqualTo(Instant.parse("2026-10-02T05:00:00Z"));
        assertThat(quiet.deliverAt(Instant.parse("2026-10-01T02:00:00Z"), MOSCOW))
                .as("05:00 Moscow").isEqualTo(Instant.parse("2026-10-01T05:00:00Z"));
        assertThat(quiet.deliverAt(Instant.parse("2026-10-01T12:00:00Z"), MOSCOW))
                .as("15:00 Moscow").isEqualTo(Instant.parse("2026-10-01T12:00:00Z"));
    }

    @Test
    void daytimeQuietHours() {
        Preferences quiet = new Preferences(Set.of(), LocalTime.of(9, 0), LocalTime.of(15, 0));

        assertThat(quiet.deliverAt(Instant.parse("2026-10-01T07:00:00Z"), MOSCOW))
                .as("10:00 Moscow").isEqualTo(Instant.parse("2026-10-01T12:00:00Z"));
        assertThat(quiet.deliverAt(Instant.parse("2026-10-01T13:00:00Z"), MOSCOW))
                .as("16:00 Moscow").isEqualTo(Instant.parse("2026-10-01T13:00:00Z"));
        assertThat(Preferences.DEFAULT.deliverAt(Instant.EPOCH, MOSCOW)).isEqualTo(Instant.EPOCH);
    }

    @Test
    void quietHoursNeedBothEnds() {
        assertThatThrownBy(() -> new Preferences(Set.of(), LocalTime.of(22, 0), null))
                .isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> new Preferences(Set.of(), LocalTime.of(22, 0), LocalTime.of(22, 0)))
                .isInstanceOf(BusinessRuleException.class);
    }
}

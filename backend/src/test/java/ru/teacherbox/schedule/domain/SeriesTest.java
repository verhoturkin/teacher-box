package ru.teacherbox.schedule.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;

class SeriesTest {

    private static final Instant NOW = Instant.parse("2026-09-30T10:00:00Z");
    private static final LocalDate THURSDAY = LocalDate.of(2026, 10, 1);

    private static Series series(Set<DayOfWeek> days, int interval, @Nullable LocalDate endsOn) {
        return Series.create(UUID.randomUUID(), UUID.randomUUID(), days, LocalTime.of(18, 0, 30), 60, interval,
                THURSDAY, endsOn, null, null, NOW);
    }

    @Test
    void listsTheDaysOfTheSeries() {
        Series weekly = series(Set.of(DayOfWeek.THURSDAY, DayOfWeek.MONDAY), 1, null);

        assertThat(weekly.datesBetween(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 10, 12))).containsExactly(
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 8),
                LocalDate.of(2026, 10, 12));
        assertThat(weekly.weekdays()).containsExactly(DayOfWeek.MONDAY, DayOfWeek.THURSDAY);
        assertThat(weekly.startTime()).as("seconds are dropped").isEqualTo(LocalTime.of(18, 0));
        assertThat(weekly.generatedUntil()).isEqualTo(THURSDAY.minusDays(1));
    }

    @Test
    void everyOtherWeekCountsFromTheFirstWeek() {
        Series fortnightly = series(Set.of(DayOfWeek.MONDAY, DayOfWeek.THURSDAY), 2, null);

        assertThat(fortnightly.datesBetween(THURSDAY, LocalDate.of(2026, 10, 31))).containsExactly(
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 12), LocalDate.of(2026, 10, 15),
                LocalDate.of(2026, 10, 26), LocalDate.of(2026, 10, 29));
    }

    @Test
    void stopsAtTheEndDate() {
        Series limited = series(Set.of(DayOfWeek.THURSDAY), 1, LocalDate.of(2026, 10, 15));

        assertThat(limited.datesBetween(THURSDAY, LocalDate.of(2026, 12, 31))).hasSize(3);
        assertThat(limited.continuesAfter(LocalDate.of(2026, 10, 14))).isTrue();
        assertThat(limited.continuesAfter(LocalDate.of(2026, 10, 15))).isFalse();
    }

    @Test
    void keepsTheLocalTimeAcrossDaylightSavingChanges() {
        Series berlin = series(Set.of(DayOfWeek.THURSDAY), 1, null);
        ZoneId zone = ZoneId.of("Europe/Berlin");

        assertThat(berlin.startOn(LocalDate.of(2026, 10, 22), zone)).isEqualTo(Instant.parse("2026-10-22T16:00:00Z"));
        assertThat(berlin.startOn(LocalDate.of(2026, 10, 29), zone)).isEqualTo(Instant.parse("2026-10-29T17:00:00Z"));
    }

    @Test
    void endsBeforeADay() {
        Series weekly = series(Set.of(DayOfWeek.THURSDAY), 1, null);

        assertThat(weekly.endBefore(LocalDate.of(2026, 10, 15), NOW)).isTrue();
        assertThat(weekly.endsOn()).isEqualTo(LocalDate.of(2026, 10, 14));
        assertThat(weekly.endBefore(LocalDate.of(2026, 11, 1), NOW)).as("already ends earlier").isFalse();
        assertThat(weekly.endBefore(LocalDate.of(2026, 10, 8), NOW)).isTrue();
        assertThat(weekly.datesBetween(THURSDAY, LocalDate.of(2026, 12, 31))).containsExactly(THURSDAY);
    }

    @Test
    void remembersHowFarLessonsAreCreated() {
        Series weekly = series(Set.of(DayOfWeek.THURSDAY), 1, null);

        weekly.generatedThrough(LocalDate.of(2026, 12, 1), NOW);
        weekly.generatedThrough(LocalDate.of(2026, 11, 1), NOW);

        assertThat(weekly.generatedUntil()).isEqualTo(LocalDate.of(2026, 12, 1));
    }

    @Test
    void validatesTheSettings() {
        assertRule(() -> series(Set.of(), 1, null), "schedule.weekdays-empty");
        assertRule(() -> series(Set.of(DayOfWeek.MONDAY), 0, null), "schedule.interval-invalid");
        assertRule(() -> series(Set.of(DayOfWeek.MONDAY), 5, null), "schedule.interval-invalid");
        assertRule(() -> series(Set.of(DayOfWeek.MONDAY), 1, THURSDAY.minusDays(1)), "schedule.series-dates-invalid");
    }

    @Test
    void restoresAndTracksVersions() {
        Series restored = Series.restore(UUID.randomUUID(), UUID.randomUUID(), Set.of(DayOfWeek.FRIDAY),
                LocalTime.of(9, 0), 45, 1, THURSDAY, null, "Английский", "https://zoom.us/j/1", THURSDAY, NOW, NOW, 2);

        restored.markSaved(3);

        assertThat(restored.version()).isEqualTo(3);
        assertThat(restored.topic()).isEqualTo("Английский");
        assertThat(restored.meetingUrl()).isEqualTo("https://zoom.us/j/1");
        assertThat(restored.durationMinutes()).isEqualTo(45);
        assertThat(restored.intervalWeeks()).isEqualTo(1);
        assertThat(restored.startsOn()).isEqualTo(THURSDAY);
        assertThat(restored.createdAt()).isEqualTo(NOW);
        assertThat(restored.updatedAt()).isEqualTo(NOW);
        assertThat(restored.weekdays()).isEqualTo(List.of(DayOfWeek.FRIDAY));
    }

    private static void assertRule(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, String code) {
        assertThatThrownBy(call).isInstanceOfSatisfying(BusinessRuleException.class,
                e -> assertThat(e.code()).isEqualTo(code));
    }
}

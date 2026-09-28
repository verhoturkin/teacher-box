package ru.teacherbox.schedule.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.schedule.domain.OffTime.Occurrence;
import ru.teacherbox.schedule.domain.OffTime.Once;
import ru.teacherbox.schedule.domain.OffTime.Weekly;
import ru.teacherbox.shared.error.BusinessRuleException;

class OffTimeTest {

    private static final ZoneId MOSCOW = ZoneId.of("Europe/Moscow");
    private static final ZoneId BERLIN = ZoneId.of("Europe/Berlin");
    /** A Monday. */
    private static final LocalDate MONDAY = LocalDate.of(2026, 10, 5);
    private static final Instant NOW = Instant.parse("2026-10-01T10:00:00Z");

    private static Instant moscow(LocalDate date, int hour) {
        return date.atTime(hour, 0).atZone(MOSCOW).toInstant();
    }

    private static Weekly weekly(Set<DayOfWeek> days, int from, int to) {
        return new Weekly(days, LocalTime.of(from, 0), LocalTime.of(to, 0), MONDAY, null);
    }

    @Test
    void aOneTimePeriodOverlapsOrNot() {
        Once holiday = new Once(moscow(MONDAY, 0), moscow(MONDAY.plusDays(10), 0));

        assertThat(holiday.kind()).isEqualTo(OffTime.Kind.ONCE);
        assertThat(holiday.between(moscow(MONDAY, 12), moscow(MONDAY, 13), MOSCOW))
                .containsExactly(new Occurrence(holiday.startsAt(), holiday.endsAt()));
        assertThat(holiday.between(moscow(MONDAY.plusDays(10), 0), moscow(MONDAY.plusDays(11), 0), MOSCOW))
                .isEmpty();
        assertThat(holiday.between(moscow(MONDAY.minusDays(1), 0), moscow(MONDAY, 0), MOSCOW)).isEmpty();
    }

    @Test
    void aOneTimePeriodEndsAfterItStartsAndWithinAYear() {
        Instant start = moscow(MONDAY, 10);

        assertThatThrownBy(() -> new Once(start, start))
                .isInstanceOf(BusinessRuleException.class)
                .hasFieldOrPropertyWithValue("code", "schedule.off-time-invalid");
        assertThatThrownBy(() -> new Once(start, start.plus(OffTime.MAX_ONCE).plusSeconds(1)))
                .isInstanceOf(BusinessRuleException.class);
        assertThat(new Once(start, start.plus(OffTime.MAX_ONCE)).endsAt()).isAfter(start);
    }

    @Test
    void aWeeklyPeriodRepeatsOnItsDays() {
        Weekly lunch = weekly(EnumSet.of(DayOfWeek.WEDNESDAY, DayOfWeek.MONDAY), 13, 14);

        assertThat(lunch.kind()).isEqualTo(OffTime.Kind.WEEKLY);
        assertThat(lunch.orderedWeekdays()).containsExactly(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY);
        assertThat(lunch.between(moscow(MONDAY, 0), moscow(MONDAY.plusDays(8), 0), MOSCOW)).containsExactly(
                new Occurrence(moscow(MONDAY, 13), moscow(MONDAY, 14)),
                new Occurrence(moscow(MONDAY.plusDays(2), 13), moscow(MONDAY.plusDays(2), 14)),
                new Occurrence(moscow(MONDAY.plusDays(7), 13), moscow(MONDAY.plusDays(7), 14)));
        assertThat(lunch.between(moscow(MONDAY, 14), moscow(MONDAY, 18), MOSCOW)).isEmpty();
    }

    @Test
    void aWeeklyPeriodKeepsWithinItsDates() {
        Weekly lunch = new Weekly(Set.of(DayOfWeek.MONDAY), LocalTime.of(13, 0), LocalTime.of(14, 0),
                MONDAY.plusDays(7), MONDAY.plusDays(14));

        assertThat(lunch.between(moscow(MONDAY, 0), moscow(MONDAY.plusDays(30), 0), MOSCOW))
                .extracting(Occurrence::start)
                .containsExactly(moscow(MONDAY.plusDays(7), 13), moscow(MONDAY.plusDays(14), 13));
    }

    @Test
    void anEndNotAfterTheStartIsOnTheNextDay() {
        Weekly night = weekly(Set.of(DayOfWeek.SUNDAY), 22, 7);
        Weekly dayOff = weekly(Set.of(DayOfWeek.SATURDAY), 0, 0);
        LocalDate sunday = MONDAY.plusDays(6);

        // The night of the Sunday reaches into the Monday after it.
        assertThat(night.between(moscow(sunday.plusDays(1), 6), moscow(sunday.plusDays(1), 12), MOSCOW))
                .containsExactly(new Occurrence(moscow(sunday, 22), moscow(sunday.plusDays(1), 7)));
        assertThat(dayOff.between(moscow(MONDAY, 0), moscow(MONDAY.plusDays(7), 0), MOSCOW))
                .containsExactly(new Occurrence(moscow(MONDAY.plusDays(5), 0), moscow(MONDAY.plusDays(6), 0)));
    }

    @Test
    void theLocalTimeStaysOverADaylightSavingChange() {
        Weekly lunch = new Weekly(Set.of(DayOfWeek.MONDAY), LocalTime.of(13, 0), LocalTime.of(14, 0),
                LocalDate.of(2026, 10, 19), null);
        Instant from = Instant.parse("2026-10-19T00:00:00Z");

        assertThat(lunch.between(from, from.plus(Duration.ofDays(14)), BERLIN))
                .extracting(Occurrence::start)
                .containsExactly(Instant.parse("2026-10-19T11:00:00Z"), Instant.parse("2026-10-26T12:00:00Z"));
    }

    @Test
    void aWeeklyPeriodNeedsDaysAndDatesInOrder() {
        assertThatThrownBy(() -> weekly(Set.of(), 13, 14))
                .isInstanceOf(BusinessRuleException.class)
                .hasFieldOrPropertyWithValue("code", "schedule.weekdays-empty");
        assertThatThrownBy(() -> new Weekly(Set.of(DayOfWeek.MONDAY), LocalTime.NOON, LocalTime.MIDNIGHT, MONDAY,
                MONDAY.minusDays(1)))
                .isInstanceOf(BusinessRuleException.class)
                .hasFieldOrPropertyWithValue("code", "schedule.off-time-invalid");
        assertThat(new Weekly(Set.of(DayOfWeek.MONDAY), LocalTime.of(13, 0, 59), LocalTime.of(14, 0, 1), MONDAY,
                MONDAY).startTime()).isEqualTo(LocalTime.of(13, 0));
    }

    @Test
    void createsAndChangesWithANote() {
        OffTime offTime = OffTime.create(UUID.randomUUID(), weekly(Set.of(DayOfWeek.FRIDAY), 13, 14), "  Обед ",
                NOW);

        assertThat(offTime.note()).isEqualTo("Обед");
        assertThat(offTime.createdAt()).isEqualTo(NOW);
        assertThat(offTime.version()).isZero();

        Once holiday = new Once(moscow(MONDAY, 0), moscow(MONDAY.plusDays(3), 0));
        offTime.change(holiday, " ", NOW.plusSeconds(60));

        assertThat(offTime.period()).isEqualTo(holiday);
        assertThat(offTime.note()).isNull();
        assertThat(offTime.updatedAt()).isEqualTo(NOW.plusSeconds(60));
        assertThat(offTime.between(moscow(MONDAY, 12), moscow(MONDAY, 13), MOSCOW)).hasSize(1);
        offTime.markSaved(1);
        assertThat(offTime.version()).isEqualTo(1);
    }
}

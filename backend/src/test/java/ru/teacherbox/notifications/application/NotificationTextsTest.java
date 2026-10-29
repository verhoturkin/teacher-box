package ru.teacherbox.notifications.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Currency;
import java.util.List;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.money.Money;
import ru.teacherbox.shared.time.InstanceTimeZone;

class NotificationTextsTest {

    private static final Language RU = Language.RU;
    private static final Language EN = Language.EN;
    private static final Currency RUB = Currency.getInstance("RUB");
    private final NotificationTexts texts = new NotificationTexts(new InstanceTimeZone(ZoneId.of("Asia/Yekaterinburg")));

    @Test
    void formatsMoneyWithoutNeedlessFraction() {
        assertThat(texts.money(Money.of(150_000, RUB), RU)).isEqualTo("1 500 ₽");
        assertThat(texts.money(Money.of(123_456_789, RUB), RU)).isEqualTo("1 234 567,89 ₽");
        assertThat(texts.money(Money.of(5, RUB), RU)).isEqualTo("0,05 ₽");
        assertThat(texts.money(Money.of(-20_000, RUB), RU)).isEqualTo("−200 ₽");
        assertThat(texts.money(Money.of(1_000, Currency.getInstance("USD")), RU)).isEqualTo("10 $");
    }

    @Test
    void describesBalanceAsDebtWhenNegative() {
        assertThat(texts.balance(Money.of(-150_000, RUB), RU)).isEqualTo("Задолженность: 1 500 ₽");
        assertThat(texts.balance(Money.of(0, RUB), RU)).isEqualTo("Баланс: 0 ₽");
        assertThat(texts.balance(Money.of(50_000, RUB), RU)).isEqualTo("Баланс: 500 ₽");
    }

    @Test
    void formatsDatesInInstanceTimeZone() {
        assertThat(texts.date(LocalDate.of(2026, 1, 5))).isEqualTo("05.01.2026");
        assertThat(texts.dateTime(Instant.parse("2026-09-25T20:15:00Z"))).isEqualTo("26.09.2026 01:15");
    }

    @Test
    void formatsLessonTimesAndWeeklySchedules() {
        assertThat(texts.lessonTime(Instant.parse("2026-10-01T13:00:00Z"), RU)).isEqualTo("четверг, 01.10 в 18:00");
        assertThat(texts.weekly(List.of(DayOfWeek.THURSDAY, DayOfWeek.MONDAY), LocalTime.of(18, 0), RU))
                .isEqualTo("по понедельникам и четвергам в 18:00");
        assertThat(texts.weekly(List.of(DayOfWeek.SUNDAY), LocalTime.of(9, 30), RU)).isEqualTo("по воскресеньям в 09:30");
        assertThat(texts.weekly(List.of(DayOfWeek.FRIDAY, DayOfWeek.WEDNESDAY, DayOfWeek.MONDAY), LocalTime.NOON, RU))
                .isEqualTo("по понедельникам, средам и пятницам в 12:00");
    }

    @Test
    void formatsDurationsWithRussianPlurals() {
        assertThat(texts.duration(Duration.ofHours(1), RU)).isEqualTo("1 час");
        assertThat(texts.duration(Duration.ofHours(3), RU)).isEqualTo("3 часа");
        assertThat(texts.duration(Duration.ofHours(12), RU)).isEqualTo("12 часов");
        assertThat(texts.duration(Duration.ofDays(1), RU)).isEqualTo("24 часа");
        assertThat(texts.duration(Duration.ofDays(2), RU)).isEqualTo("2 дня");
        assertThat(texts.duration(Duration.ofMinutes(30), RU)).isEqualTo("30 минут");
        assertThat(texts.duration(Duration.ofMinutes(21), RU)).isEqualTo("21 минуту");
        assertThat(texts.duration(Duration.ofMinutes(90), RU)).isEqualTo("90 минут");
        assertThat(texts.duration(Duration.ofHours(22), RU)).isEqualTo("22 часа");
        assertThat(texts.duration(Duration.ofDays(5), RU)).isEqualTo("5 дней");
    }

    @Test
    void writesInEnglish() {
        assertThat(texts.money(Money.of(123_456_789, RUB), EN)).isEqualTo("₽1,234,567.89");
        assertThat(texts.balance(Money.of(-150_000, RUB), EN)).isEqualTo("Amount due: ₽1,500");
        assertThat(texts.balance(Money.of(50_000, RUB), EN)).isEqualTo("Balance: ₽500");
        assertThat(texts.lessonTime(Instant.parse("2026-10-01T13:00:00Z"), EN)).isEqualTo("Thursday, 01.10 at 18:00");
        assertThat(texts.weekly(List.of(DayOfWeek.THURSDAY, DayOfWeek.MONDAY), LocalTime.of(18, 0), EN))
                .isEqualTo("on Mondays and Thursdays at 18:00");
        assertThat(texts.weekly(List.of(DayOfWeek.SUNDAY), LocalTime.of(9, 30), EN)).isEqualTo("on Sundays at 09:30");
        assertThat(texts.duration(Duration.ofHours(1), EN)).isEqualTo("1 hour");
        assertThat(texts.duration(Duration.ofDays(1), EN)).isEqualTo("24 hours");
        assertThat(texts.duration(Duration.ofDays(2), EN)).isEqualTo("2 days");
        assertThat(texts.duration(Duration.ofMinutes(1), EN)).isEqualTo("1 minute");
        assertThat(texts.duration(Duration.ofMinutes(30), EN)).isEqualTo("30 minutes");
    }
}

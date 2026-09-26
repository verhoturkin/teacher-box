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
import ru.teacherbox.shared.money.Money;
import ru.teacherbox.shared.time.InstanceTimeZone;

class NotificationTextsTest {

    private static final Currency RUB = Currency.getInstance("RUB");
    private final NotificationTexts texts = new NotificationTexts(new InstanceTimeZone(ZoneId.of("Asia/Yekaterinburg")));

    @Test
    void formatsMoneyWithoutNeedlessFraction() {
        assertThat(texts.money(Money.of(150_000, RUB))).isEqualTo("1 500 ₽");
        assertThat(texts.money(Money.of(123_456_789, RUB))).isEqualTo("1 234 567,89 ₽");
        assertThat(texts.money(Money.of(5, RUB))).isEqualTo("0,05 ₽");
        assertThat(texts.money(Money.of(-20_000, RUB))).isEqualTo("−200 ₽");
        assertThat(texts.money(Money.of(1_000, Currency.getInstance("USD")))).isEqualTo("10 $");
    }

    @Test
    void describesBalanceAsDebtWhenNegative() {
        assertThat(texts.balance(Money.of(-150_000, RUB))).isEqualTo("Задолженность: 1 500 ₽");
        assertThat(texts.balance(Money.of(0, RUB))).isEqualTo("Баланс: 0 ₽");
        assertThat(texts.balance(Money.of(50_000, RUB))).isEqualTo("Баланс: 500 ₽");
    }

    @Test
    void formatsDatesInInstanceTimeZone() {
        assertThat(texts.date(LocalDate.of(2026, 1, 5))).isEqualTo("05.01.2026");
        assertThat(texts.dateTime(Instant.parse("2026-09-25T20:15:00Z"))).isEqualTo("26.09.2026 01:15");
    }

    @Test
    void formatsLessonTimesAndWeeklySchedules() {
        assertThat(texts.lessonTime(Instant.parse("2026-10-01T13:00:00Z"))).isEqualTo("четверг, 01.10 в 18:00");
        assertThat(texts.weekly(List.of(DayOfWeek.THURSDAY, DayOfWeek.MONDAY), LocalTime.of(18, 0)))
                .isEqualTo("по понедельникам и четвергам в 18:00");
        assertThat(texts.weekly(List.of(DayOfWeek.SUNDAY), LocalTime.of(9, 30))).isEqualTo("по воскресеньям в 09:30");
        assertThat(texts.weekly(List.of(DayOfWeek.FRIDAY, DayOfWeek.WEDNESDAY, DayOfWeek.MONDAY), LocalTime.NOON))
                .isEqualTo("по понедельникам, средам и пятницам в 12:00");
    }

    @Test
    void formatsDurationsWithRussianPlurals() {
        assertThat(texts.duration(Duration.ofHours(1))).isEqualTo("1 час");
        assertThat(texts.duration(Duration.ofHours(3))).isEqualTo("3 часа");
        assertThat(texts.duration(Duration.ofHours(12))).isEqualTo("12 часов");
        assertThat(texts.duration(Duration.ofDays(1))).isEqualTo("24 часа");
        assertThat(texts.duration(Duration.ofDays(2))).isEqualTo("2 дня");
        assertThat(texts.duration(Duration.ofMinutes(30))).isEqualTo("30 минут");
        assertThat(texts.duration(Duration.ofMinutes(21))).isEqualTo("21 минуту");
        assertThat(texts.duration(Duration.ofMinutes(90))).isEqualTo("90 минут");
        assertThat(NotificationTexts.plural(111, "час", "часа", "часов")).isEqualTo("111 часов");
        assertThat(NotificationTexts.plural(22, "час", "часа", "часов")).isEqualTo("22 часа");
        assertThat(NotificationTexts.plural(5, "день", "дня", "дней")).isEqualTo("5 дней");
    }
}

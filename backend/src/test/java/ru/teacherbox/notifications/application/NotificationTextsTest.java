package ru.teacherbox.notifications.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Currency;
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
}

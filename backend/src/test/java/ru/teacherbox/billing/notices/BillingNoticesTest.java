package ru.teacherbox.billing.notices;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Currency;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.money.Money;

class BillingNoticesTest {

    private static final Currency RUB = Currency.getInstance("RUB");

    @Test
    void describesBalanceAsDebtWhenNegative() {
        assertThat(BillingNotices.balance(Money.of(-150_000, RUB), Language.RU)).isEqualTo("Задолженность: 1 500 ₽");
        assertThat(BillingNotices.balance(Money.of(0, RUB), Language.RU)).isEqualTo("Баланс: 0 ₽");
        assertThat(BillingNotices.balance(Money.of(50_000, RUB), Language.RU)).isEqualTo("Баланс: 500 ₽");
    }

    @Test
    void writesInEnglish() {
        assertThat(BillingNotices.balance(Money.of(-150_000, RUB), Language.EN)).isEqualTo("Amount due: ₽1,500");
        assertThat(BillingNotices.balance(Money.of(50_000, RUB), Language.EN)).isEqualTo("Balance: ₽500");
    }
}

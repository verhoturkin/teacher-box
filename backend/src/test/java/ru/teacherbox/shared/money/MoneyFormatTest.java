package ru.teacherbox.shared.money;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Currency;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.i18n.Language;

class MoneyFormatTest {

    private static final Currency RUB = Currency.getInstance("RUB");

    @Test
    void amountsAsPeopleReadThemInEachLanguage() {
        assertThat(MoneyFormat.russian(Money.of(150_000, RUB))).isEqualTo("1 500 ₽");
        assertThat(MoneyFormat.format(Money.of(9_950, RUB), Language.RU)).isEqualTo("99,50 ₽");
        assertThat(MoneyFormat.format(Money.of(-20_000, RUB), Language.RU)).isEqualTo("−200 ₽");
        assertThat(MoneyFormat.format(Money.of(150_000, RUB), Language.EN)).isEqualTo("₽1,500");
        assertThat(MoneyFormat.format(Money.of(9_950, RUB), Language.EN)).isEqualTo("₽99.50");
        assertThat(MoneyFormat.format(Money.of(-20_000, RUB), Language.EN)).isEqualTo("−₽200");
        assertThat(MoneyFormat.format(Money.of(1_000, Currency.getInstance("USD")), Language.EN)).isEqualTo("$10");
    }
}

package ru.teacherbox.shared.money;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.Currency;
import org.junit.jupiter.api.Test;

class MoneyTest {

    private static final Currency RUB = Currency.getInstance("RUB");
    private static final Currency USD = Currency.getInstance("USD");

    @Test
    void arithmetic() {
        Money a = Money.of(150_000, RUB);
        Money b = Money.of(50_050, RUB);

        assertThat(a.plus(b)).isEqualTo(Money.of(200_050, RUB));
        assertThat(a.minus(b)).isEqualTo(Money.of(99_950, RUB));
        assertThat(b.negate()).isEqualTo(Money.of(-50_050, RUB));
    }

    @Test
    void signPredicates() {
        assertThat(Money.zero(RUB).isZero()).isTrue();
        assertThat(Money.of(1, RUB).isPositive()).isTrue();
        assertThat(Money.of(-1, RUB).isNegative()).isTrue();
        assertThat(Money.of(1, RUB).isNegative()).isFalse();
        assertThat(Money.of(-1, RUB).isPositive()).isFalse();
        assertThat(Money.of(1, RUB).isZero()).isFalse();
    }

    @Test
    void decimalConversion() {
        assertThat(Money.ofDecimal(new BigDecimal("1500.5"), RUB)).isEqualTo(Money.of(150_050, RUB));
        assertThat(Money.of(150_050, RUB).toDecimal()).isEqualByComparingTo("1500.50");
    }

    @Test
    void rejectsTooPreciseDecimals() {
        assertThatThrownBy(() -> Money.ofDecimal(new BigDecimal("1.001"), RUB))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("RUB");
    }

    @Test
    void comparison() {
        assertThat(Money.of(1, RUB)).isLessThan(Money.of(2, RUB));
    }

    @Test
    void rejectsCurrencyMismatch() {
        assertThatThrownBy(() -> Money.of(1, RUB).plus(Money.of(1, USD)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("RUB vs USD");
    }

    @Test
    void detectsOverflow() {
        assertThatThrownBy(() -> Money.of(Long.MAX_VALUE, RUB).plus(Money.of(1, RUB)))
                .isInstanceOf(ArithmeticException.class);
    }
}

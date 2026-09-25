package ru.teacherbox.shared.money;

import java.math.BigDecimal;
import java.util.Currency;
import java.util.Objects;

/**
 * Monetary amount stored in minor units (e.g. kopecks) to avoid floating point errors.
 */
public record Money(long amountMinor, Currency currency) implements Comparable<Money> {

    public Money {
        Objects.requireNonNull(currency, "currency");
    }

    public static Money of(long amountMinor, Currency currency) {
        return new Money(amountMinor, currency);
    }

    public static Money zero(Currency currency) {
        return new Money(0, currency);
    }

    /**
     * Converts a decimal amount (e.g. {@code 1500.50}) into minor units.
     *
     * @throws IllegalArgumentException if the amount has more fraction digits than the currency allows
     */
    public static Money ofDecimal(BigDecimal amount, Currency currency) {
        Objects.requireNonNull(amount, "amount");
        int fractionDigits = currency.getDefaultFractionDigits();
        try {
            long minor = amount.movePointRight(fractionDigits).longValueExact();
            return new Money(minor, currency);
        } catch (ArithmeticException e) {
            throw new IllegalArgumentException(
                    "Amount " + amount + " is not representable in " + currency.getCurrencyCode(), e);
        }
    }

    public BigDecimal toDecimal() {
        return BigDecimal.valueOf(amountMinor, currency.getDefaultFractionDigits());
    }

    public Money plus(Money other) {
        requireSameCurrency(other);
        return new Money(Math.addExact(amountMinor, other.amountMinor), currency);
    }

    public Money minus(Money other) {
        requireSameCurrency(other);
        return new Money(Math.subtractExact(amountMinor, other.amountMinor), currency);
    }

    public Money negate() {
        return new Money(Math.negateExact(amountMinor), currency);
    }

    public boolean isZero() {
        return amountMinor == 0;
    }

    public boolean isPositive() {
        return amountMinor > 0;
    }

    public boolean isNegative() {
        return amountMinor < 0;
    }

    @Override
    public int compareTo(Money other) {
        requireSameCurrency(other);
        return Long.compare(amountMinor, other.amountMinor);
    }

    private void requireSameCurrency(Money other) {
        if (!currency.equals(other.currency)) {
            throw new IllegalArgumentException(
                    "Currency mismatch: " + currency.getCurrencyCode() + " vs " + other.currency.getCurrencyCode());
        }
    }
}

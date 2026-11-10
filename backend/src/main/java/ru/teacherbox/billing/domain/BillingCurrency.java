package ru.teacherbox.billing.domain;

import java.util.Currency;
import java.util.Objects;
import java.util.function.Supplier;
import ru.teacherbox.shared.money.Money;

/**
 * The single currency of the instance, as the teacher set it (ADR-0056); amounts are stored in its minor units.
 * It is read from its source on every call, so a change before the first operation is in force at once.
 */
public final class BillingCurrency {

    private final Supplier<Currency> source;

    public BillingCurrency(Supplier<Currency> source) {
        this.source = Objects.requireNonNull(source, "source");
    }

    /** A fixed currency. */
    public BillingCurrency(Currency currency) {
        Objects.requireNonNull(currency, "currency");
        this.source = () -> currency;
    }

    public Currency currency() {
        return source.get();
    }

    public Money of(long amountMinor) {
        return Money.of(amountMinor, currency());
    }

    public String code() {
        return currency().getCurrencyCode();
    }
}

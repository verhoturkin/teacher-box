package ru.teacherbox.billing.domain;

import java.util.Currency;
import java.util.Objects;
import ru.teacherbox.shared.money.Money;

/** The single currency of the instance ({@code TEACHERBOX_BILLING_CURRENCY}); amounts are stored in its minor units. */
public record BillingCurrency(Currency currency) {

    public BillingCurrency {
        Objects.requireNonNull(currency, "currency");
    }

    public Money of(long amountMinor) {
        return Money.of(amountMinor, currency);
    }

    public String code() {
        return currency.getCurrencyCode();
    }
}

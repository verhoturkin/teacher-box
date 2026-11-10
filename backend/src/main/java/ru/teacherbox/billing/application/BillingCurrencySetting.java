package ru.teacherbox.billing.application;

import java.time.Clock;
import java.util.Currency;
import java.util.Locale;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.billing.persistence.BillingSettingsRepository;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;

/**
 * The instance currency in {@code billing.settings.currency} (ADR-0056); not set: {@link #DEFAULT}. The variable
 * {@code TEACHERBOX_BILLING_CURRENCY} is only imported once ({@link BillingSettingsImport}). Amounts are stored
 * without their currency, so it can be changed only while there is no charge and no payment. Kept in memory
 * between changes: every amount read uses it; a full reset forgets it, a restore restarts the portal.
 */
@Service
public class BillingCurrencySetting {

    public static final Currency DEFAULT = Currency.getInstance("RUB");

    /** The currency and whether it can still be changed. */
    public record CurrencyView(String currency, boolean locked) {
    }

    private final BillingSettingsRepository settings;
    private final JdbcClient jdbc;
    private final Clock clock;
    private volatile @Nullable Currency cached;

    public BillingCurrencySetting(BillingSettingsRepository settings, JdbcClient jdbc, Clock clock) {
        this.settings = settings;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public Currency current() {
        Currency known = cached;
        if (known == null) {
            known = settings.currency().flatMap(BillingCurrencySetting::parse).orElse(DEFAULT);
            cached = known;
        }
        return known;
    }

    public CurrencyView view() {
        return new CurrencyView(current().getCurrencyCode(), locked());
    }

    /**
     * @param code an ISO 4217 code, e.g. {@code EUR}
     * @throws BusinessRuleException if the code is unknown or has no minor units defined
     * @throws ConflictException     once a charge or a payment exists
     */
    @Transactional
    public CurrencyView change(String code) {
        Currency currency = parse(code).orElseThrow(() -> new BusinessRuleException("billing.currency-invalid",
                "Unknown currency"));
        if (!currency.equals(current()) && locked()) {
            throw new ConflictException("billing.currency-locked",
                    "The currency cannot be changed once a charge or a payment is recorded");
        }
        settings.saveCurrency(currency.getCurrencyCode(), clock.instant());
        cached = currency;
        return view();
    }

    /** After a full reset: the stored value is read again. */
    public void forget() {
        cached = null;
    }

    private boolean locked() {
        return jdbc.sql("""
                select (select count(*) from billing.lessons) + (select count(*) from billing.payments)
                """).query(Long.class).single() > 0;
    }

    static Optional<Currency> parse(String code) {
        String trimmed = code.strip().toUpperCase(Locale.ROOT);
        if (!trimmed.matches("[A-Z]{3}")) {
            return Optional.empty();
        }
        try {
            Currency currency = Currency.getInstance(trimmed);
            return currency.getDefaultFractionDigits() < 0 ? Optional.empty() : Optional.of(currency);
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}

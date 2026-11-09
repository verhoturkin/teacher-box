package ru.teacherbox.billing.application;

import java.time.Clock;
import java.util.Currency;
import java.util.Set;
import org.springframework.stereotype.Component;
import ru.teacherbox.billing.persistence.BillingSettingsRepository;
import ru.teacherbox.shared.settings.OldSettings;
import ru.teacherbox.shared.settings.TeacherSettingsImport;

/**
 * The currency from {@code .env} once (ADR-0056). The lesson length of billing becomes the one of the
 * schedule, so the schedule takes {@code TEACHERBOX_BILLING_DEFAULT_LESSON_DURATION}.
 */
@Component
public class BillingSettingsImport implements TeacherSettingsImport {

    static final String CURRENCY = "TEACHERBOX_BILLING_CURRENCY";

    private final BillingSettingsRepository settings;
    private final BillingCurrencySetting currency;
    private final Clock clock;

    public BillingSettingsImport(BillingSettingsRepository settings, BillingCurrencySetting currency, Clock clock) {
        this.settings = settings;
        this.currency = currency;
        this.clock = clock;
    }

    @Override
    public Set<String> names() {
        return Set.of(CURRENCY);
    }

    @Override
    public Set<String> importFrom(OldSettings values) {
        Set<String> stored = values.value(CURRENCY, Currency.class)
                .filter(code -> settings.saveCurrencyIfMissing(code.getCurrencyCode(), clock.instant()))
                .map(code -> Set.of(CURRENCY))
                .orElse(Set.of());
        currency.forget();
        return stored;
    }
}

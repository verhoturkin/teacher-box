package ru.teacherbox.billing.application;

import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.billing.domain.BillingCurrency;
import ru.teacherbox.billing.persistence.BillingSettingsRepository;
import ru.teacherbox.shared.money.Money;

/**
 * Lesson price of new students and groups: the teacher sets it (first setup, «Оплаты»); until then
 * {@code TEACHERBOX_BILLING_DEFAULT_LESSON_PRICE}. Prices already given to students do not change.
 */
@Service
public class DefaultLessonPrice {

    private final BillingSettingsRepository settings;
    private final BillingProperties properties;
    private final BillingCurrency currency;
    private final Clock clock;

    public DefaultLessonPrice(BillingSettingsRepository settings, BillingProperties properties,
            BillingCurrency currency, Clock clock) {
        this.settings = settings;
        this.properties = properties;
        this.currency = currency;
        this.clock = clock;
    }

    public Money current() {
        return settings.defaultLessonPrice()
                .map(currency::of)
                .orElseGet(() -> Money.ofDecimal(properties.defaultLessonPrice(), currency.currency()));
    }

    /** @param price minor units */
    @Transactional
    public long change(long price) {
        Money money = currency.of(price);
        settings.saveDefaultLessonPrice(money.amountMinor(), clock.instant());
        return money.amountMinor();
    }
}

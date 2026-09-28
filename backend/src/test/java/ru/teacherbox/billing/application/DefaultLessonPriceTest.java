package ru.teacherbox.billing.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.util.Currency;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import ru.teacherbox.billing.domain.BillingCurrency;
import ru.teacherbox.billing.persistence.BillingSettingsRepository;
import ru.teacherbox.shared.money.Money;

class DefaultLessonPriceTest {

    private static final Currency RUB = Currency.getInstance("RUB");

    @Test
    void isZeroUntilTheTeacherSetsIt() {
        BillingSettingsRepository settings = mock(BillingSettingsRepository.class);
        BillingCurrency currency = new BillingCurrency(RUB);
        DefaultLessonPrice price = new DefaultLessonPrice(settings, currency, Clock.systemUTC());

        when(settings.defaultLessonPrice()).thenReturn(Optional.empty());
        assertThat(price.current()).isEqualTo(Money.zero(RUB));

        when(settings.defaultLessonPrice()).thenReturn(Optional.of(180_000L));
        assertThat(price.current()).isEqualTo(Money.of(180_000, RUB));
    }
}

package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.teacherbox.billing.application.BillingCurrencySetting;
import ru.teacherbox.billing.application.BillingSettingsImport;
import ru.teacherbox.billing.persistence.BillingSettingsRepository;
import ru.teacherbox.shared.settings.OldSettings;

/** The currency of an upgraded instance comes from {@code .env} once (ADR-0056). */
@BillingIntegrationTest
class SettingsImportIntegrationTests {

    @Autowired
    BillingSettingsImport settingsImport;

    @Autowired
    BillingSettingsRepository settings;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    BillingCurrencySetting currency;

    @AfterEach
    void noCurrency() {
        jdbc.sql("update billing.settings set currency = null where id = 1").update();
        currency.forget();
    }

    @Test
    void anUpgradedInstanceKeepsItsCurrencyAndASecondImportChangesNothing() {
        assertThat(settingsImport.importFrom(values("EUR"))).containsExactly("TEACHERBOX_BILLING_CURRENCY");
        assertThat(settings.currency()).contains("EUR");

        assertThat(settingsImport.importFrom(values("USD"))).isEmpty();
        assertThat(settings.currency()).contains("EUR");
    }

    @Test
    void anUnknownCurrencyIsNotImported() {
        assertThat(settingsImport.importFrom(values("рубли"))).isEmpty();
        assertThat(settingsImport.importFrom(new OldSettings(Map.of()))).isEmpty();
        assertThat(settings.currency()).isEmpty();
    }

    private static OldSettings values(String currency) {
        return new OldSettings(Map.of("TEACHERBOX_BILLING_CURRENCY", currency));
    }
}

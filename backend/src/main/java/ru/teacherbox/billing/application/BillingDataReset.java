package ru.teacherbox.billing.application;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.reset.DataReset;

/**
 * Full reset (ADR-0014): lessons, payments with their receipts, prices, the default lesson price and the
 * currency. The receipt files are deleted by the platform.
 */
@Component
class BillingDataReset implements DataReset {

    private static final List<String> TABLES = List.of("billing.lessons", "billing.payments",
            "billing.student_accounts", "billing.group_prices", "billing.settings", "billing.pending_receipts");

    private final JdbcClient jdbc;
    private final BillingCurrencySetting currency;

    BillingDataReset(JdbcClient jdbc, BillingCurrencySetting currency) {
        this.jdbc = jdbc;
        this.currency = currency;
    }

    @Override
    public List<String> tables() {
        return TABLES;
    }

    @Override
    public void erase() {
        jdbc.sql("delete from billing.lessons").update();
        jdbc.sql("delete from billing.payments").update();
        jdbc.sql("delete from billing.pending_receipts").update();
        jdbc.sql("delete from billing.student_accounts").update();
        jdbc.sql("delete from billing.group_prices").update();
        jdbc.sql("""
                update billing.settings
                set default_lesson_price = null, currency = null, updated_at = null, version = version + 1
                where id = 1
                """).update();
        currency.forget();
    }
}

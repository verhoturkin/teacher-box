package ru.teacherbox.billing.application;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.reset.DataReset;

/**
 * Full reset (ADR-0014): lessons, payments, prices; the default lesson price goes back to the
 * environment.
 */
@Component
class BillingDataReset implements DataReset {

    private static final List<String> TABLES = List.of("billing.lessons", "billing.payments",
            "billing.student_accounts", "billing.group_prices", "billing.settings");

    private final JdbcClient jdbc;

    BillingDataReset(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<String> tables() {
        return TABLES;
    }

    @Override
    public void erase() {
        jdbc.sql("delete from billing.lessons").update();
        jdbc.sql("delete from billing.payments").update();
        jdbc.sql("delete from billing.student_accounts").update();
        jdbc.sql("delete from billing.group_prices").update();
        jdbc.sql("""
                update billing.settings
                set default_lesson_price = null, updated_at = null, version = version + 1
                where id = 1
                """).update();
    }
}

package ru.teacherbox.billing.persistence;

import java.time.Instant;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The single row of {@code billing.settings}. */
@Repository
public class BillingSettingsRepository {

    private final JdbcClient jdbc;

    public BillingSettingsRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Minor units; empty until the teacher sets it. */
    public Optional<Long> defaultLessonPrice() {
        return jdbc.sql("select default_lesson_price from billing.settings where id = 1")
                .query((rs, row) -> {
                    long price = rs.getLong("default_lesson_price");
                    return rs.wasNull() ? Optional.<Long>empty() : Optional.of(price);
                })
                .single();
    }

    public void saveDefaultLessonPrice(long price, Instant now) {
        jdbc.sql("""
                update billing.settings
                set default_lesson_price = :price, updated_at = :now, version = version + 1
                where id = 1
                """)
                .param("price", price)
                .param("now", now)
                .update();
    }
}

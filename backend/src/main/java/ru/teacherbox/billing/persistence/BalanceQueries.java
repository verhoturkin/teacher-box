package ru.teacherbox.billing.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.billing.domain.BalanceTotals;
import ru.teacherbox.billing.domain.BillingCurrency;

/** Aggregated balances computed in the database. */
@Repository
public class BalanceQueries {

    /** Charged lessons and valid payments of every student with at least one entry. */
    private static final String TOTALS = """
            select student_id, sum(charged) as charged, sum(paid) as paid, sum(lessons) as lessons,
                   max(last_lesson) as last_lesson
            from (
                select student_id, price as charged, 0 as paid, 1 as lessons, lesson_date as last_lesson
                from billing.lessons
                where status <> 'CANCELLED'
                union all
                select student_id, 0, amount, 0, cast(null as date)
                from billing.payments
                where voided_at is null
            ) entries
            """;

    private final JdbcClient jdbc;
    private final BillingCurrency currency;

    public BalanceQueries(JdbcClient jdbc, BillingCurrency currency) {
        this.jdbc = jdbc;
        this.currency = currency;
    }

    /** Totals of every student that has lessons or payments. */
    public Map<UUID, BalanceTotals> totalsByStudent() {
        Map<UUID, BalanceTotals> result = new LinkedHashMap<>();
        jdbc.sql(TOTALS + " group by student_id").query((ResultSet rs) -> {
            result.put(rs.getObject("student_id", UUID.class), map(rs));
        });
        return result;
    }

    public BalanceTotals totalsOf(UUID studentId) {
        return jdbc.sql(TOTALS + " where student_id = :studentId group by student_id")
                .param("studentId", studentId)
                .query((rs, rowNum) -> map(rs))
                .optional()
                .orElseGet(() -> BalanceTotals.empty(currency.currency()));
    }

    private BalanceTotals map(ResultSet rs) throws SQLException {
        return new BalanceTotals(
                currency.of(rs.getLong("charged")),
                currency.of(rs.getLong("paid")),
                rs.getInt("lessons"),
                rs.getObject("last_lesson", LocalDate.class));
    }
}

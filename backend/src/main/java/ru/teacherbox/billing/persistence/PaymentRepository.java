package ru.teacherbox.billing.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.billing.domain.BillingCurrency;
import ru.teacherbox.billing.domain.Payment;
import ru.teacherbox.billing.domain.PaymentMethod;

@Repository
public class PaymentRepository {

    private static final String SELECT = """
            select id, student_id, amount, paid_on, method, comment, created_at, voided_at, void_reason
            from billing.payments
            """;
    private static final String ORDER = " order by paid_on desc, created_at desc";

    private final JdbcClient jdbc;
    private final BillingCurrency currency;

    public PaymentRepository(JdbcClient jdbc, BillingCurrency currency) {
        this.jdbc = jdbc;
        this.currency = currency;
    }

    public void insert(Payment payment) {
        jdbc.sql("""
                insert into billing.payments (id, student_id, amount, paid_on, method, comment, created_at,
                    voided_at, void_reason)
                values (:id, :studentId, :amount, :paidOn, :method, :comment, :createdAt, :voidedAt, :voidReason)
                """)
                .param("id", payment.id())
                .param("studentId", payment.studentId())
                .param("amount", payment.amount().amountMinor())
                .param("paidOn", payment.paidOn())
                .param("method", payment.method().name())
                .param("comment", payment.comment())
                .param("createdAt", payment.createdAt())
                .param("voidedAt", payment.voidedAt())
                .param("voidReason", payment.voidReason())
                .update();
    }

    /** Persists voiding (the only mutable part of a payment). */
    public void updateVoiding(Payment payment) {
        jdbc.sql("update billing.payments set voided_at = :voidedAt, void_reason = :voidReason where id = :id")
                .param("id", payment.id())
                .param("voidedAt", payment.voidedAt())
                .param("voidReason", payment.voidReason())
                .update();
    }

    public Optional<Payment> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(this::map).optional();
    }

    public List<Payment> findByStudent(UUID studentId) {
        return jdbc.sql(SELECT + " where student_id = :studentId" + ORDER)
                .param("studentId", studentId)
                .query(this::map)
                .list();
    }

    /** Payments dated within {@code [from, to]}, newest first. */
    public List<Payment> findBetween(LocalDate from, LocalDate to) {
        return jdbc.sql(SELECT + " where paid_on between :from and :to" + ORDER)
                .param("from", from)
                .param("to", to)
                .query(this::map)
                .list();
    }

    private Payment map(ResultSet rs, int rowNum) throws SQLException {
        return Payment.restore(
                rs.getObject("id", UUID.class),
                rs.getObject("student_id", UUID.class),
                currency.of(rs.getLong("amount")),
                rs.getObject("paid_on", LocalDate.class),
                PaymentMethod.valueOf(rs.getString("method")),
                rs.getString("comment"),
                rs.getObject("created_at", Instant.class),
                rs.getObject("voided_at", Instant.class),
                rs.getString("void_reason"));
    }
}

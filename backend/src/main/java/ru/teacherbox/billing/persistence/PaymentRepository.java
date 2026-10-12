package ru.teacherbox.billing.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.billing.domain.BillingCurrency;
import ru.teacherbox.billing.domain.Payment;
import ru.teacherbox.billing.domain.Receipt;

@Repository
public class PaymentRepository {

    private static final String SELECT = """
            select id, student_id, amount, paid_on, comment, created_at, voided_at, void_reason, receipt_key,
                   receipt_name, receipt_type, receipt_size
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
                insert into billing.payments (id, student_id, amount, paid_on, comment, created_at, voided_at,
                    void_reason, receipt_key, receipt_name, receipt_type, receipt_size)
                values (:id, :studentId, :amount, :paidOn, :comment, :createdAt, :voidedAt, :voidReason,
                    :receiptKey, :receiptName, :receiptType, :receiptSize)
                """)
                .param("id", payment.id())
                .param("studentId", payment.studentId())
                .param("amount", payment.amount().amountMinor())
                .param("paidOn", payment.paidOn())
                .param("comment", payment.comment())
                .param("createdAt", payment.createdAt())
                .param("voidedAt", payment.voidedAt())
                .param("voidReason", payment.voidReason())
                .param("receiptKey", payment.receipt() == null ? null : payment.receipt().key())
                .param("receiptName", payment.receipt() == null ? null : payment.receipt().filename())
                .param("receiptType", payment.receipt() == null ? null : payment.receipt().contentType())
                .param("receiptSize", payment.receipt() == null ? null : payment.receipt().size())
                .update();
    }

    /** Persists the receipt of the payment (attached, replaced or removed). */
    public void updateReceipt(Payment payment) {
        Receipt receipt = payment.receipt();
        jdbc.sql("""
                update billing.payments
                set receipt_key = :key, receipt_name = :name, receipt_type = :type, receipt_size = :size
                where id = :id
                """)
                .param("id", payment.id())
                .param("key", receipt == null ? null : receipt.key())
                .param("name", receipt == null ? null : receipt.filename())
                .param("type", receipt == null ? null : receipt.contentType())
                .param("size", receipt == null ? null : receipt.size())
                .update();
    }

    /** Remembers a receipt sent to the bot before its payment is recorded. */
    public void insertPendingReceipt(String key, Instant now) {
        jdbc.sql("insert into billing.pending_receipts (file_key, created_at) values (:key, :now)")
                .param("key", key)
                .param("now", now)
                .update();
    }

    /** @return {@code true} if the receipt was waiting (and is no longer) */
    public boolean takePendingReceipt(String key) {
        return jdbc.sql("delete from billing.pending_receipts where file_key = :key").param("key", key).update() == 1;
    }

    /** Keys of receipts that waited for their payment since before {@code before}. */
    public List<String> findPendingReceiptsBefore(Instant before) {
        return jdbc.sql("select file_key from billing.pending_receipts where created_at < :before order by created_at")
                .param("before", before)
                .query(String.class)
                .list();
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

    private static @Nullable Receipt receipt(ResultSet rs) throws SQLException {
        String key = rs.getString("receipt_key");
        return key == null ? null
                : new Receipt(key, rs.getString("receipt_name"), rs.getString("receipt_type"),
                        rs.getLong("receipt_size"));
    }

    private Payment map(ResultSet rs, int rowNum) throws SQLException {
        return Payment.restore(
                rs.getObject("id", UUID.class),
                rs.getObject("student_id", UUID.class),
                currency.of(rs.getLong("amount")),
                rs.getObject("paid_on", LocalDate.class),
                rs.getString("comment"),
                rs.getObject("created_at", Instant.class),
                rs.getObject("voided_at", Instant.class),
                rs.getString("void_reason"),
                receipt(rs));
    }
}

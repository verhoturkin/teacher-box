package ru.teacherbox.billing.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.money.Money;

/**
 * A payment from a student, possibly with a receipt. A wrong payment is voided (and stays visible), never
 * deleted.
 */
public final class Payment {

    private final UUID id;
    private final UUID studentId;
    private final Money amount;
    private final LocalDate paidOn;
    private final @Nullable String comment;
    private final Instant createdAt;
    private @Nullable Instant voidedAt;
    private @Nullable String voidReason;
    private @Nullable Receipt receipt;

    private Payment(UUID id, UUID studentId, Money amount, LocalDate paidOn, @Nullable String comment,
            Instant createdAt, @Nullable Instant voidedAt, @Nullable String voidReason, @Nullable Receipt receipt) {
        this.id = Objects.requireNonNull(id);
        this.studentId = Objects.requireNonNull(studentId);
        this.amount = Objects.requireNonNull(amount);
        this.paidOn = Objects.requireNonNull(paidOn);
        this.comment = comment;
        this.createdAt = Objects.requireNonNull(createdAt);
        this.voidedAt = voidedAt;
        this.voidReason = voidReason;
        this.receipt = receipt;
    }

    public static Payment record(UUID id, UUID studentId, Money amount, LocalDate paidOn, @Nullable String comment,
            Instant now) {
        if (!amount.isPositive()) {
            throw new BusinessRuleException("payment.amount-invalid", "Payment amount must be positive");
        }
        return new Payment(id, studentId, amount, paidOn, Texts.optional(comment, "payment.comment-invalid"), now,
                null, null, null);
    }

    public static Payment restore(UUID id, UUID studentId, Money amount, LocalDate paidOn, @Nullable String comment,
            Instant createdAt, @Nullable Instant voidedAt, @Nullable String voidReason, @Nullable Receipt receipt) {
        return new Payment(id, studentId, amount, paidOn, comment, createdAt, voidedAt, voidReason, receipt);
    }

    /**
     * Attaches the receipt, replacing the one before.
     *
     * @return the replaced receipt, whose file is no longer needed
     */
    public Optional<Receipt> attachReceipt(Receipt newReceipt) {
        Optional<Receipt> previous = Optional.ofNullable(receipt);
        receipt = Objects.requireNonNull(newReceipt);
        return previous;
    }

    /** @return the removed receipt, whose file is no longer needed */
    public Optional<Receipt> removeReceipt() {
        Optional<Receipt> previous = Optional.ofNullable(receipt);
        receipt = null;
        return previous;
    }

    public void voidPayment(@Nullable String reason, Instant now) {
        if (isVoided()) {
            throw new BusinessRuleException("payment.already-voided", "The payment is already voided");
        }
        voidedAt = now;
        voidReason = Texts.optional(reason, "payment.reason-invalid");
    }

    public boolean isVoided() {
        return voidedAt != null;
    }

    /** Amount credited to the balance: the amount, or zero for a voided payment. */
    public Money credit() {
        return isVoided() ? Money.zero(amount.currency()) : amount;
    }

    public UUID id() {
        return id;
    }

    public UUID studentId() {
        return studentId;
    }

    public Money amount() {
        return amount;
    }

    public LocalDate paidOn() {
        return paidOn;
    }

    public @Nullable String comment() {
        return comment;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public @Nullable Instant voidedAt() {
        return voidedAt;
    }

    public @Nullable String voidReason() {
        return voidReason;
    }

    public @Nullable Receipt receipt() {
        return receipt;
    }
}

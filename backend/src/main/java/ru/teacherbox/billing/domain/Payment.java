package ru.teacherbox.billing.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.money.Money;

/** A payment from a student. A wrong payment is voided (and stays visible), never deleted. */
public final class Payment {

    private final UUID id;
    private final UUID studentId;
    private final Money amount;
    private final LocalDate paidOn;
    private final PaymentMethod method;
    private final @Nullable String comment;
    private final Instant createdAt;
    private @Nullable Instant voidedAt;
    private @Nullable String voidReason;

    private Payment(UUID id, UUID studentId, Money amount, LocalDate paidOn, PaymentMethod method,
            @Nullable String comment, Instant createdAt, @Nullable Instant voidedAt, @Nullable String voidReason) {
        this.id = Objects.requireNonNull(id);
        this.studentId = Objects.requireNonNull(studentId);
        this.amount = Objects.requireNonNull(amount);
        this.paidOn = Objects.requireNonNull(paidOn);
        this.method = Objects.requireNonNull(method);
        this.comment = comment;
        this.createdAt = Objects.requireNonNull(createdAt);
        this.voidedAt = voidedAt;
        this.voidReason = voidReason;
    }

    public static Payment record(UUID id, UUID studentId, Money amount, LocalDate paidOn, PaymentMethod method,
            @Nullable String comment, Instant now) {
        if (!amount.isPositive()) {
            throw new BusinessRuleException("payment.amount-invalid", "Payment amount must be positive");
        }
        return new Payment(id, studentId, amount, paidOn, method, Texts.optional(comment, "payment.comment-invalid"),
                now, null, null);
    }

    public static Payment restore(UUID id, UUID studentId, Money amount, LocalDate paidOn, PaymentMethod method,
            @Nullable String comment, Instant createdAt, @Nullable Instant voidedAt, @Nullable String voidReason) {
        return new Payment(id, studentId, amount, paidOn, method, comment, createdAt, voidedAt, voidReason);
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

    public PaymentMethod method() {
        return method;
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
}

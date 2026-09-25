package ru.teacherbox.billing.api;

import java.time.Instant;
import java.util.UUID;
import ru.teacherbox.shared.money.Money;

/** A payment was voided (registered by mistake) and no longer counts towards the balance. */
public record PaymentVoided(
        UUID paymentId,
        UUID studentId,
        Money amount,
        Money balanceAfter,
        Instant occurredAt) {
}

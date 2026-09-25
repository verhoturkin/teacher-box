package ru.teacherbox.billing.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import ru.teacherbox.shared.money.Money;

/** The teacher registered a payment from the student. */
public record PaymentRecorded(
        UUID paymentId,
        UUID studentId,
        Money amount,
        LocalDate paidOn,
        Money balanceAfter,
        Instant occurredAt) {
}

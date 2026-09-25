package ru.teacherbox.billing.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import ru.teacherbox.shared.money.Money;

/** A lesson was cancelled and its charge removed from the balance. */
public record LessonCancelled(
        UUID lessonId,
        UUID studentId,
        LocalDate lessonDate,
        Money balanceAfter,
        Instant occurredAt) {
}

package ru.teacherbox.billing.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import ru.teacherbox.shared.money.Money;

/**
 * A lesson was added to the log and charged to the student.
 *
 * @param missed       {@code true} if the student missed the lesson without notice (still charged)
 * @param balanceAfter student balance after the charge (negative = debt)
 */
public record LessonRecorded(
        UUID lessonId,
        UUID studentId,
        LocalDate lessonDate,
        int durationMinutes,
        Money price,
        boolean missed,
        Money balanceAfter,
        Instant occurredAt) {
}

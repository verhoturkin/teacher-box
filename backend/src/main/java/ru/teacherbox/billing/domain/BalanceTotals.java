package ru.teacherbox.billing.domain;

import java.time.LocalDate;
import java.util.Currency;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.money.Money;

/**
 * Aggregated ledger of a student.
 *
 * @param charged        sum of charged lessons
 * @param paid           sum of valid payments
 * @param chargedLessons number of charged lessons
 * @param lastLessonDate date of the latest charged lesson
 */
public record BalanceTotals(Money charged, Money paid, int chargedLessons, @Nullable LocalDate lastLessonDate) {

    public static BalanceTotals empty(Currency currency) {
        return new BalanceTotals(Money.zero(currency), Money.zero(currency), 0, null);
    }

    /** Paid minus charged: positive is prepayment, negative is debt. */
    public Money balance() {
        return paid.minus(charged);
    }
}

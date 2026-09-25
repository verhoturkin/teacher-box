package ru.teacherbox.billing.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.billing.domain.BalanceTotals;
import ru.teacherbox.billing.domain.Lesson;
import ru.teacherbox.billing.domain.LessonStatus;
import ru.teacherbox.billing.domain.Payment;
import ru.teacherbox.billing.domain.PaymentMethod;
import ru.teacherbox.identity.api.StudentStatus;

/**
 * Read models of the billing API. All amounts are integers in minor units of {@code currency}
 * (e.g. kopecks); balances are "paid minus charged": negative means debt.
 */
public final class BillingViews {

    private BillingViews() {
    }

    public record LessonView(
            UUID id,
            UUID studentId,
            LocalDate date,
            int durationMinutes,
            long price,
            @Nullable String topic,
            LessonStatus status,
            Instant createdAt,
            @Nullable Instant cancelledAt,
            @Nullable String cancelReason) {

        static LessonView of(Lesson lesson) {
            return new LessonView(lesson.id(), lesson.studentId(), lesson.date(), lesson.durationMinutes(),
                    lesson.price().amountMinor(), lesson.topic(), lesson.status(), lesson.createdAt(),
                    lesson.cancelledAt(), lesson.cancelReason());
        }
    }

    public record PaymentView(
            UUID id,
            UUID studentId,
            long amount,
            LocalDate paidOn,
            PaymentMethod method,
            @Nullable String comment,
            Instant createdAt,
            @Nullable Instant voidedAt,
            @Nullable String voidReason) {

        static PaymentView of(Payment payment) {
            return new PaymentView(payment.id(), payment.studentId(), payment.amount().amountMinor(),
                    payment.paidOn(), payment.method(), payment.comment(), payment.createdAt(), payment.voidedAt(),
                    payment.voidReason());
        }
    }

    /** One row of the teacher's overview. */
    public record StudentBalance(
            UUID studentId,
            String displayName,
            StudentStatus status,
            long lessonPrice,
            long balance,
            long charged,
            long paid,
            int chargedLessons,
            @Nullable LocalDate lastLessonDate) {

        static StudentBalance of(UUID studentId, String displayName, StudentStatus status, long lessonPrice,
                BalanceTotals totals) {
            return new StudentBalance(studentId, displayName, status, lessonPrice,
                    totals.balance().amountMinor(), totals.charged().amountMinor(), totals.paid().amountMinor(),
                    totals.chargedLessons(), totals.lastLessonDate());
        }
    }

    /**
     * @param totalDebt     sum of negative balances, as a positive number
     * @param totalPrepaid  sum of positive balances
     */
    public record Overview(
            String currency,
            long defaultLessonPrice,
            int defaultLessonDuration,
            long totalDebt,
            long totalPrepaid,
            List<StudentBalance> students) {
    }

    /** Full history of one student. */
    public record StudentLedger(
            String currency,
            UUID studentId,
            String displayName,
            long lessonPrice,
            long balance,
            long charged,
            long paid,
            List<LessonView> lessons,
            List<PaymentView> payments) {
    }

    public record MonthlyStudentRow(
            UUID studentId,
            String displayName,
            int chargedLessons,
            long charged,
            long paid) {
    }

    /** A lesson of the month with the student's name (journal). */
    public record JournalLesson(String studentName, LessonView lesson) {
    }

    /** A payment of the month with the student's name. */
    public record JournalPayment(String studentName, PaymentView payment) {
    }

    /**
     * @param income  valid payments dated in the month
     * @param charged charged lessons dated in the month
     */
    public record MonthlyReport(
            String month,
            String currency,
            long income,
            long charged,
            int conductedLessons,
            int missedLessons,
            int cancelledLessons,
            List<MonthlyStudentRow> students,
            List<JournalLesson> lessons,
            List<JournalPayment> payments) {
    }
}

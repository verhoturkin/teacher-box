package ru.teacherbox.billing.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Currency;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.money.Money;

class BillingDomainTest {

    private static final Instant NOW = Instant.parse("2026-09-01T10:00:00Z");
    private static final LocalDate DAY = LocalDate.parse("2026-09-01");
    private static final BillingCurrency RUB = new BillingCurrency(Currency.getInstance("RUB"));

    @Test
    void recordsAndCancelsLessons() {
        Lesson lesson = Lesson.record(UUID.randomUUID(), UUID.randomUUID(), DAY, 60, RUB.of(150_000), "  Дроби ",
                LessonStatus.CONDUCTED, NOW);

        assertThat(lesson.topic()).isEqualTo("Дроби");
        assertThat(lesson.charge()).isEqualTo(RUB.of(150_000));

        lesson.cancel("  ", NOW.plusSeconds(1));

        assertThat(lesson.status()).isEqualTo(LessonStatus.CANCELLED);
        assertThat(lesson.charge()).isEqualTo(RUB.of(0));
        assertThat(lesson.cancelledAt()).isEqualTo(NOW.plusSeconds(1));
        assertThat(lesson.cancelReason()).isNull();
        assertThatThrownBy(() -> lesson.cancel("again", NOW))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("already cancelled");
    }

    @Test
    void missedLessonsAreCharged() {
        Lesson lesson = Lesson.record(UUID.randomUUID(), UUID.randomUUID(), DAY, 45, RUB.of(100), null,
                LessonStatus.MISSED, NOW);

        assertThat(lesson.status().isCharged()).isTrue();
        assertThat(lesson.charge()).isEqualTo(RUB.of(100));
        assertThat(lesson.durationMinutes()).isEqualTo(45);
    }

    @Test
    void validatesLessons() {
        UUID student = UUID.randomUUID();
        assertThatThrownBy(() -> Lesson.record(UUID.randomUUID(), student, DAY, 0, RUB.of(1), null,
                LessonStatus.CONDUCTED, NOW)).hasMessageContaining("duration");
        assertThatThrownBy(() -> Lesson.record(UUID.randomUUID(), student, DAY, 601, RUB.of(1), null,
                LessonStatus.CONDUCTED, NOW)).hasMessageContaining("duration");
        assertThatThrownBy(() -> Lesson.record(UUID.randomUUID(), student, DAY, 60, RUB.of(-1), null,
                LessonStatus.CONDUCTED, NOW)).hasMessageContaining("negative");
        assertThatThrownBy(() -> Lesson.record(UUID.randomUUID(), student, DAY, 60, RUB.of(1), null,
                LessonStatus.CANCELLED, NOW)).hasMessageContaining("conducted or missed");
        assertThatThrownBy(() -> Lesson.record(UUID.randomUUID(), student, DAY, 60, RUB.of(1), "x".repeat(501),
                LessonStatus.CONDUCTED, NOW))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(e -> ((BusinessRuleException) e).code()).isEqualTo("lesson.topic-invalid");
    }

    @Test
    void recordsAndVoidsPayments() {
        Payment payment = Payment.record(UUID.randomUUID(), UUID.randomUUID(), RUB.of(500_000), DAY,
                PaymentMethod.TRANSFER, "за сентябрь", NOW);
        assertThat(payment.credit()).isEqualTo(RUB.of(500_000));
        assertThat(payment.isVoided()).isFalse();

        payment.voidPayment(" ошибка ", NOW.plusSeconds(5));

        assertThat(payment.isVoided()).isTrue();
        assertThat(payment.credit()).isEqualTo(RUB.of(0));
        assertThat(payment.voidReason()).isEqualTo("ошибка");
        assertThatThrownBy(() -> payment.voidPayment(null, NOW)).hasMessageContaining("already voided");
    }

    @Test
    void paymentAmountMustBePositive() {
        assertThatThrownBy(() -> Payment.record(UUID.randomUUID(), UUID.randomUUID(), RUB.of(0), DAY,
                PaymentMethod.CASH, null, NOW))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(e -> ((BusinessRuleException) e).code()).isEqualTo("payment.amount-invalid");
    }

    @Test
    void studentAccountPrice() {
        StudentAccount account = StudentAccount.open(UUID.randomUUID(), RUB.of(100_000), NOW);

        account.changeLessonPrice(RUB.of(120_000), NOW.plusSeconds(1));
        account.markSaved(3);

        assertThat(account.lessonPrice()).isEqualTo(RUB.of(120_000));
        assertThat(account.updatedAt()).isEqualTo(NOW.plusSeconds(1));
        assertThat(account.createdAt()).isEqualTo(NOW);
        assertThat(account.version()).isEqualTo(3);
        assertThatThrownBy(() -> account.changeLessonPrice(RUB.of(-1), NOW)).hasMessageContaining("negative");
        assertThatThrownBy(() -> StudentAccount.open(UUID.randomUUID(), RUB.of(-1), NOW))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void balanceIsPaidMinusCharged() {
        BalanceTotals totals = new BalanceTotals(RUB.of(300), RUB.of(100), 2, DAY);

        assertThat(totals.balance()).isEqualTo(Money.of(-200, RUB.currency()));
        assertThat(BalanceTotals.empty(RUB.currency()).balance().isZero()).isTrue();
        assertThat(RUB.code()).isEqualTo("RUB");
    }
}

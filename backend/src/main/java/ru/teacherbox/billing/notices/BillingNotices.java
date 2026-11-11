package ru.teacherbox.billing.notices;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import java.util.function.BiFunction;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.billing.api.LessonCancelled;
import ru.teacherbox.billing.api.LessonRecorded;
import ru.teacherbox.billing.api.PaymentRecorded;
import ru.teacherbox.billing.api.PaymentVoided;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.money.Money;
import ru.teacherbox.shared.money.MoneyFormat;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.notice.NoticeText;

/**
 * Billing writes its notices (ADR-0061): the student learns about a charged lesson, a removed
 * charge and a payment, each with the new balance. Every notice is written in each language;
 * {@code notifications} picks the student's.
 *
 * <p>The listeners run in the transaction that published the event, so a notice is saved with the
 * operation it tells about.
 */
@Component
class BillingNotices {

    static final String LINK = "/cabinet/billing";
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private final ApplicationEventPublisher events;

    BillingNotices(ApplicationEventPublisher events) {
        this.events = events;
    }

    @EventListener
    void on(LessonRecorded event) {
        String date = date(event.lessonDate());
        notify(event.studentId(), BillingNoticeKind.LESSON_RECORDED, (t, language) -> new NoticeText(
                event.missed() ? t.lessonMissed(date) : t.lessonRecorded(date),
                t.price(MoneyFormat.format(event.price(), language)) + " " + balance(event.balanceAfter(), language)));
    }

    /**
     * The charge of a lesson was taken off: the teacher corrected a wrong mark or the outcome in the
     * schedule was withdrawn. It is not a cancelled lesson (that one is told by the schedule), so the
     * student is told about the money only.
     */
    @EventListener
    void on(LessonCancelled event) {
        notify(event.studentId(), BillingNoticeKind.LESSON_CANCELLED, (t, language) -> new NoticeText(
                t.chargeRemoved(date(event.lessonDate())),
                t.notCharged() + " " + balance(event.balanceAfter(), language)));
    }

    @EventListener
    void on(PaymentRecorded event) {
        notify(event.studentId(), BillingNoticeKind.PAYMENT_RECORDED, (t, language) -> new NoticeText(
                t.paymentRecorded(MoneyFormat.format(event.amount(), language)),
                balance(event.balanceAfter(), language)));
    }

    @EventListener
    void on(PaymentVoided event) {
        notify(event.studentId(), BillingNoticeKind.PAYMENT_VOIDED, (t, language) -> new NoticeText(
                t.paymentVoided(MoneyFormat.format(event.amount(), language)),
                balance(event.balanceAfter(), language)));
    }

    private void notify(UUID studentId, BillingNoticeKind kind,
            BiFunction<BillingNoticeTexts, Language, NoticeText> write) {
        events.publishEvent(NoticeRequested.of(studentId, kind,
                language -> write.apply(BillingNoticeTexts.of(language), language), LINK));
    }

    /** "Баланс: 1 500 ₽" or "Задолженность: 1 500 ₽"; "Balance: ₽1,500" or "Amount due: ₽1,500". */
    static String balance(Money balance, Language language) {
        BillingNoticeTexts t = BillingNoticeTexts.of(language);
        return balance.isNegative() ? t.amountDue(MoneyFormat.format(balance.negate(), language))
                : t.balance(MoneyFormat.format(balance, language));
    }

    private static String date(LocalDate date) {
        return DATE.format(date);
    }
}

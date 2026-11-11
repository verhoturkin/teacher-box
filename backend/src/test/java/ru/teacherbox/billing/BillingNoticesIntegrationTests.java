package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.modulith.test.AssertablePublishedEvents;
import org.springframework.transaction.support.TransactionTemplate;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.notice.NoticeText;
import ru.teacherbox.testing.FakeUserDirectory;
import java.time.LocalDate;
import java.util.Currency;
import ru.teacherbox.billing.api.LessonCancelled;
import ru.teacherbox.billing.api.LessonRecorded;
import ru.teacherbox.billing.api.PaymentRecorded;
import ru.teacherbox.billing.api.PaymentVoided;
import ru.teacherbox.shared.money.Money;

/** Billing events become notices with the new balance, in the transaction of the event (ADR-0061). */
@BillingIntegrationTest
class BillingNoticesIntegrationTests {

    private static final Currency RUB = Currency.getInstance("RUB");

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    ApplicationEventPublisher publisher;

    @Autowired
    TransactionTemplate transactions;

    @Test
    void lessonsAndPayments(AssertablePublishedEvents events) {
        UUID student = directory.addStudent("Плательщик");
        LocalDate date = LocalDate.of(2026, 9, 24);

        NoticeRequested lesson = single(events, student, new LessonRecorded(UUID.randomUUID(), student, date, 60,
                rub(150_000), false, rub(-150_000), Instant.now()));
        assertThat(lesson.kind()).isEqualTo("LESSON_RECORDED");
        assertThat(ru(lesson).title()).isEqualTo("Занятие 24.09.2026");
        assertThat(ru(lesson).body()).isEqualTo("Стоимость: 1 500 ₽. Задолженность: 1 500 ₽");
        assertThat(lesson.link()).isEqualTo("/cabinet/billing");

        UUID missedStudent = directory.addStudent("Прогульщик");
        NoticeRequested missed = single(events, missedStudent, new LessonRecorded(UUID.randomUUID(),
                missedStudent, date, 60, rub(150_050), true, rub(0), Instant.now()));
        assertThat(ru(missed).title()).isEqualTo("Пропуск занятия 24.09.2026");
        assertThat(ru(missed).body()).isEqualTo("Стоимость: 1 500,50 ₽. Баланс: 0 ₽");

        UUID payer = directory.addStudent("Оплатил");
        NoticeRequested payment = single(events, payer,
                new PaymentRecorded(UUID.randomUUID(), payer, rub(300_000), date, rub(150_000), Instant.now()));
        assertThat(payment.kind()).isEqualTo("PAYMENT_RECORDED");
        assertThat(ru(payment).title()).isEqualTo("Получена оплата 3 000 ₽");
        assertThat(ru(payment).body()).isEqualTo("Баланс: 1 500 ₽");

        UUID voided = directory.addStudent("Ошибка");
        NoticeRequested voidedPayment = single(events, voided,
                new PaymentVoided(UUID.randomUUID(), voided, rub(300_000), rub(-10_000), Instant.now()));
        assertThat(voidedPayment.kind()).isEqualTo("PAYMENT_VOIDED");
        assertThat(ru(voidedPayment).title()).isEqualTo("Оплата 3 000 ₽ аннулирована");
        assertThat(ru(voidedPayment).body()).isEqualTo("Задолженность: 100 ₽");

        UUID cancelled = directory.addStudent("Отмена");
        NoticeRequested cancelledLesson = single(events, cancelled,
                new LessonCancelled(UUID.randomUUID(), cancelled, date, rub(0), Instant.now()));
        // the charge was taken off: the lesson is not told as «cancelled» (the schedule does that)
        assertThat(cancelledLesson.kind()).isEqualTo("LESSON_CANCELLED");
        assertThat(ru(cancelledLesson).title()).isEqualTo("Начисление за занятие 24.09.2026 снято");
        assertThat(ru(cancelledLesson).body()).isEqualTo("Занятие не оплачивается. Баланс: 0 ₽");
    }

    @Test
    void everyNoticeIsWrittenInEnglishToo(AssertablePublishedEvents events) {
        UUID payer = directory.addStudent("Payer");

        NoticeRequested lesson = single(events, payer, new LessonRecorded(UUID.randomUUID(), payer,
                LocalDate.of(2026, 9, 24), 60, rub(150_000), false, rub(-150_000), Instant.now()));

        assertThat(en(lesson).title()).isEqualTo("Lesson completed: 24.09.2026");
        assertThat(en(lesson).body()).isEqualTo("Price: ₽1,500. Amount due: ₽1,500");
    }

    private static Money rub(long kopecks) {
        return Money.of(kopecks, RUB);
    }

    private NoticeRequested single(AssertablePublishedEvents events, UUID recipient, Object event) {
        publish(event);
        List<NoticeRequested> written = notices(events, recipient);
        assertThat(written).hasSize(1);
        return written.getFirst();
    }

    /** As the application services do: an event is published inside a transaction. */
    private void publish(Object event) {
        transactions.executeWithoutResult(status -> publisher.publishEvent(event));
    }

    private static List<NoticeRequested> notices(AssertablePublishedEvents events, UUID recipient) {
        return StreamSupport.stream(events.ofType(NoticeRequested.class)
                .matching(notice -> notice.recipientId().equals(recipient)).spliterator(), false).toList();
    }

    private static NoticeText ru(NoticeRequested notice) {
        return notice.text(Language.RU);
    }

    private static NoticeText en(NoticeRequested notice) {
        return notice.text(Language.EN);
    }
}

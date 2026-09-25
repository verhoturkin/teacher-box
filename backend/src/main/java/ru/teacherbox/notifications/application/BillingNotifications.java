package ru.teacherbox.notifications.application;

import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.billing.api.LessonCancelled;
import ru.teacherbox.billing.api.LessonRecorded;
import ru.teacherbox.billing.api.PaymentRecorded;
import ru.teacherbox.billing.api.PaymentVoided;
import ru.teacherbox.notifications.domain.NotificationKind;

/** Billing events → notifications to the student with the new balance. */
@Component
class BillingNotifications {

    static final String LINK = "/cabinet/billing";

    private final NotificationService notifications;
    private final NotificationTexts texts;

    BillingNotifications(NotificationService notifications, NotificationTexts texts) {
        this.notifications = notifications;
        this.texts = texts;
    }

    @ApplicationModuleListener
    void on(LessonRecorded event) {
        String date = texts.date(event.lessonDate());
        notifications.notify(event.studentId(), NotificationKind.LESSON_RECORDED,
                event.missed() ? "Пропуск занятия " + date : "Занятие " + date,
                "Стоимость: " + texts.money(event.price()) + ". " + texts.balance(event.balanceAfter()),
                LINK);
    }

    @ApplicationModuleListener
    void on(LessonCancelled event) {
        notifications.notify(event.studentId(), NotificationKind.LESSON_CANCELLED,
                "Занятие " + texts.date(event.lessonDate()) + " отменено",
                "Оплата за него не списывается. " + texts.balance(event.balanceAfter()),
                LINK);
    }

    @ApplicationModuleListener
    void on(PaymentRecorded event) {
        notifications.notify(event.studentId(), NotificationKind.PAYMENT_RECORDED,
                "Получена оплата " + texts.money(event.amount()),
                texts.balance(event.balanceAfter()),
                LINK);
    }

    @ApplicationModuleListener
    void on(PaymentVoided event) {
        notifications.notify(event.studentId(), NotificationKind.PAYMENT_VOIDED,
                "Оплата " + texts.money(event.amount()) + " аннулирована",
                texts.balance(event.balanceAfter()),
                LINK);
    }
}

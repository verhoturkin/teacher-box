package ru.teacherbox.notifications.application;

import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.identity.api.UserDirectory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.billing.api.LessonCancelled;
import ru.teacherbox.billing.api.LessonRecorded;
import ru.teacherbox.billing.api.PaymentRecorded;
import ru.teacherbox.billing.api.PaymentVoided;
import ru.teacherbox.notifications.domain.NotificationKind;

/** Billing events → notifications to the student with the new balance, in the student's language. */
@Component
class BillingNotifications {

    static final String LINK = "/cabinet/billing";

    private final NotificationService notifications;
    private final NotificationTexts texts;
    private final UserDirectory users;

    BillingNotifications(NotificationService notifications, NotificationTexts texts, UserDirectory users) {
        this.notifications = notifications;
        this.texts = texts;
        this.users = users;
    }

    @ApplicationModuleListener
    void on(LessonRecorded event) {
        Language language = users.language(event.studentId());
        NotificationMessages t = NotificationMessages.of(language);
        String date = texts.date(event.lessonDate());
        notifications.notify(event.studentId(), NotificationKind.LESSON_RECORDED,
                event.missed() ? t.lessonMissed(date) : t.lessonRecorded(date),
                t.price(texts.money(event.price(), language)) + " " + texts.balance(event.balanceAfter(), language),
                LINK);
    }

    /**
     * The charge of a lesson was taken off: the teacher corrected a wrong mark or the outcome in the
     * schedule was withdrawn. It is not a cancelled lesson (that one is told by the schedule), so the
     * student is told about the money only.
     */
    @ApplicationModuleListener
    void on(LessonCancelled event) {
        Language language = users.language(event.studentId());
        NotificationMessages t = NotificationMessages.of(language);
        notifications.notify(event.studentId(), NotificationKind.LESSON_CANCELLED,
                t.chargeRemoved(texts.date(event.lessonDate())),
                t.notCharged() + " " + texts.balance(event.balanceAfter(), language),
                LINK);
    }

    @ApplicationModuleListener
    void on(PaymentRecorded event) {
        Language language = users.language(event.studentId());
        notifications.notify(event.studentId(), NotificationKind.PAYMENT_RECORDED,
                NotificationMessages.of(language).paymentRecorded(texts.money(event.amount(), language)),
                texts.balance(event.balanceAfter(), language),
                LINK);
    }

    @ApplicationModuleListener
    void on(PaymentVoided event) {
        Language language = users.language(event.studentId());
        notifications.notify(event.studentId(), NotificationKind.PAYMENT_VOIDED,
                NotificationMessages.of(language).paymentVoided(texts.money(event.amount(), language)),
                texts.balance(event.balanceAfter(), language),
                LINK);
    }
}

package ru.teacherbox.billing.notices;

import ru.teacherbox.shared.i18n.Language;

/** Texts of the billing notices in each language (ADR-0036); dates and amounts come formatted. */
enum BillingNoticeTexts {

    RU {
        @Override String lessonRecorded(String date) { return "Занятие " + date; }
        @Override String lessonMissed(String date) { return "Пропуск занятия " + date; }
        @Override String price(String amount) { return "Стоимость: " + amount + "."; }
        @Override String chargeRemoved(String date) { return "Начисление за занятие " + date + " снято"; }
        @Override String notCharged() { return "Занятие не оплачивается."; }
        @Override String paymentRecorded(String amount) { return "Получена оплата " + amount; }
        @Override String paymentVoided(String amount) { return "Оплата " + amount + " аннулирована"; }
        @Override String balance(String amount) { return "Баланс: " + amount; }
        @Override String amountDue(String amount) { return "Задолженность: " + amount; }
    },

    EN {
        @Override String lessonRecorded(String date) { return "Lesson completed: " + date; }
        @Override String lessonMissed(String date) { return "Lesson missed: " + date; }
        @Override String price(String amount) { return "Price: " + amount + "."; }
        @Override String chargeRemoved(String date) { return "Charge removed for the lesson on " + date; }
        @Override String notCharged() { return "You won't be charged for this lesson."; }
        @Override String paymentRecorded(String amount) { return "Payment received: " + amount; }
        @Override String paymentVoided(String amount) { return "Payment of " + amount + " voided"; }
        @Override String balance(String amount) { return "Balance: " + amount; }
        @Override String amountDue(String amount) { return "Amount due: " + amount; }
    };

    static BillingNoticeTexts of(Language language) {
        return switch (language) {
            case RU -> RU;
            case EN -> EN;
        };
    }

    abstract String lessonRecorded(String date);

    abstract String lessonMissed(String date);

    abstract String price(String amount);

    abstract String chargeRemoved(String date);

    abstract String notCharged();

    abstract String paymentRecorded(String amount);

    abstract String paymentVoided(String amount);

    /** What is left on the account after the operation. */
    abstract String balance(String amount);

    /** A negative balance, told as the amount the student owes. */
    abstract String amountDue(String amount);
}

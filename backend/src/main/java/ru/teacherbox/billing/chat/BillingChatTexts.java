package ru.teacherbox.billing.chat;

import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.i18n.Plural;

/** Texts of the billing actions of the bot in each language (ADR-0036); amounts and dates come formatted. */
enum BillingChatTexts {

    RU {
        @Override String recordPayment() { return "Записать оплату"; }
        @Override String addLesson() { return "Добавить занятие"; }
        @Override String payments() { return "Оплаты"; }
        @Override String noStudents() { return "Учеников пока нет."; }
        @Override String studentGone() { return "Этого ученика уже нет среди текущих."; }
        @Override String groupGone() { return "Этой группы уже нет среди текущих."; }
        @Override String group(String name) { return "Группа «" + name + "»"; }
        @Override String whoPaid() { return "Кто оплатил?"; }
        @Override String receiptReceived() { return "Чек получен — запишу оплату с ним."; }
        @Override String notAReceipt() {
            return "Это не похоже на чек: пришлите фото (JPEG, PNG, WebP, HEIC) или PDF до 10 МБ.";
        }
        @Override String withReceipt(String question) { return withoutQuestionMark(question) + ", с чеком?"; }
        @Override String howMuch(String student) {
            return "Сколько оплатил(а) " + student + "? Выберите или напишите сумму, например 3000.";
        }
        @Override String lessons(int count) {
            return count + " " + Plural.russian(count, "занятие", "занятия", "занятий");
        }
        @Override String amountNotUnderstood() { return "Не понял сумму."; }
        @Override String confirmPayment(String student, String amount, String date) {
            return "Записать оплату: " + student + ", " + amount + ", " + date + "?";
        }
        @Override String notRecording() { return "Хорошо, не записываю."; }
        @Override String paymentFailed() { return "Не получилось записать оплату. Запишите её на портале."; }
        @Override String paymentRecorded(String balance) { return "Оплата записана. У ученика " + balance + "."; }
        @Override String withWhom() { return "С кем было занятие?"; }
        @Override String when() { return "Когда было занятие? Выберите день или напишите дату, например 25.09."; }
        @Override String dateNotUnderstood() { return "Не понял дату."; }
        @Override String future() { return "Это день в будущем — занятие ещё не прошло."; }
        @Override String noMembers(String group) { return "В группе «" + group + "» нет учеников."; }
        @Override String confirmGroupLesson(String group, String date, int students, String price) {
            return "Добавить проведённое занятие группы «" + group + "» " + date + ": " + students(students)
                    + " по " + price + "?";
        }
        @Override String confirmLesson(String student, String date, String price) {
            return "Добавить проведённое занятие: " + student + ", " + date + ", " + price + "?";
        }
        @Override String notAdding() { return "Хорошо, не добавляю."; }
        @Override String groupLessonAdded(int students) {
            return "Занятие группы добавлено в журнал: " + students(students) + ".";
        }
        @Override String lessonAdded(String balance) { return "Занятие добавлено в журнал. У ученика " + balance + "."; }
        @Override String lessonFailed() { return "Не получилось добавить занятие. Добавьте его на портале."; }
        @Override String debt(String amount) { return "задолженность " + amount; }
        @Override String credit(String amount) { return "аванс " + amount; }
        @Override String noDebt() { return "долгов нет"; }
        @Override String debtLine(String amount) { return "Задолженность: " + amount; }
        @Override String creditLine(String amount) { return "Аванс: " + amount; }
        @Override String zeroLine() { return "Баланс: 0 — долгов нет."; }
        @Override String lessonPrice(String amount) { return "Цена занятия: " + amount; }
        @Override String latestPayments() { return "Последние оплаты:"; }
        @Override String latestLessons() { return "Последние занятия:"; }

        private String students(int count) {
            return count + " " + Plural.russian(count, "ученик", "ученика", "учеников");
        }
    },

    EN {
        @Override String recordPayment() { return "Record a payment"; }
        @Override String addLesson() { return "Add a lesson"; }
        @Override String payments() { return "Payments"; }
        @Override String noStudents() { return "No students yet."; }
        @Override String studentGone() { return "This student is no longer among the current ones."; }
        @Override String groupGone() { return "This group is no longer among the current ones."; }
        @Override String group(String name) { return "Group “" + name + "”"; }
        @Override String whoPaid() { return "Who paid?"; }
        @Override String howMuch(String student) {
            return "How much did " + student + " pay? Choose or type the amount, e.g. 3000.";
        }
        @Override String lessons(int count) { return count + " " + Plural.english(count, "lesson", "lessons"); }
        @Override String amountNotUnderstood() { return "I didn't understand the amount."; }
        @Override String confirmPayment(String student, String amount, String date) {
            return "Record the payment: " + student + ", " + amount + ", " + date + "?";
        }
        @Override String notRecording() { return "OK, not recording it."; }
        @Override String receiptReceived() { return "Receipt received — I'll record the payment with it."; }
        @Override String notAReceipt() {
            return "This doesn't look like a receipt: send a photo (JPEG, PNG, WebP, HEIC) or a PDF up to 10 MB.";
        }
        @Override String withReceipt(String question) { return withoutQuestionMark(question) + ", with the receipt?"; }
        @Override String paymentFailed() { return "Couldn't record the payment. Record it on the portal."; }
        @Override String paymentRecorded(String balance) { return "Payment recorded. The student has " + balance + "."; }
        @Override String withWhom() { return "Who was the lesson with?"; }
        @Override String when() { return "When was the lesson? Choose a day or type a date, e.g. 25.09."; }
        @Override String dateNotUnderstood() { return "I didn't understand the date."; }
        @Override String future() { return "That day is in the future — the lesson hasn't taken place yet."; }
        @Override String noMembers(String group) { return "The group “" + group + "” has no students."; }
        @Override String confirmGroupLesson(String group, String date, int students, String price) {
            return "Add a lesson of the group “" + group + "” that took place on " + date + ": " + students(students)
                    + " at " + price + "?";
        }
        @Override String confirmLesson(String student, String date, String price) {
            return "Add a lesson that took place: " + student + ", " + date + ", " + price + "?";
        }
        @Override String notAdding() { return "OK, not adding it."; }
        @Override String groupLessonAdded(int students) {
            return "The group's lesson is added to the journal: " + students(students) + ".";
        }
        @Override String lessonAdded(String balance) {
            return "The lesson is added to the journal. The student has " + balance + ".";
        }
        @Override String lessonFailed() { return "Couldn't add the lesson. Add it on the portal."; }
        @Override String debt(String amount) { return "a debt of " + amount; }
        @Override String credit(String amount) { return "a credit of " + amount; }
        @Override String noDebt() { return "no debt"; }
        @Override String debtLine(String amount) { return "Debt: " + amount; }
        @Override String creditLine(String amount) { return "Credit: " + amount; }
        @Override String zeroLine() { return "Balance: 0 — no debt."; }
        @Override String lessonPrice(String amount) { return "Lesson price: " + amount; }
        @Override String latestPayments() { return "Latest payments:"; }
        @Override String latestLessons() { return "Latest lessons:"; }

        private String students(int count) {
            return count + " " + Plural.english(count, "student", "students");
        }
    };

    static BillingChatTexts of(Language language) {
        return switch (language) {
            case RU -> RU;
            case EN -> EN;
        };
    }

    abstract String recordPayment();

    abstract String addLesson();

    abstract String payments();

    abstract String noStudents();

    abstract String studentGone();

    abstract String groupGone();

    /** A group among the students to choose from. */
    abstract String group(String name);

    abstract String whoPaid();

    abstract String howMuch(String student);

    /** «4 занятия», for a button of an amount. */
    abstract String lessons(int count);

    abstract String amountNotUnderstood();

    abstract String confirmPayment(String student, String amount, String date);

    abstract String notRecording();

    abstract String paymentFailed();

    abstract String receiptReceived();

    abstract String notAReceipt();

    /** The question to confirm a payment, saying the receipt goes with it. */
    abstract String withReceipt(String question);

    private static String withoutQuestionMark(String question) {
        return question.endsWith("?") ? question.substring(0, question.length() - 1) : question;
    }

    /** @param balance {@link #debt}, {@link #credit} or {@link #noDebt} */
    abstract String paymentRecorded(String balance);

    abstract String withWhom();

    abstract String when();

    abstract String dateNotUnderstood();

    abstract String future();

    abstract String noMembers(String group);

    abstract String confirmGroupLesson(String group, String date, int students, String price);

    abstract String confirmLesson(String student, String date, String price);

    abstract String notAdding();

    abstract String groupLessonAdded(int students);

    abstract String lessonAdded(String balance);

    abstract String lessonFailed();

    abstract String debt(String amount);

    abstract String credit(String amount);

    abstract String noDebt();

    abstract String debtLine(String amount);

    abstract String creditLine(String amount);

    abstract String zeroLine();

    abstract String lessonPrice(String amount);

    abstract String latestPayments();

    abstract String latestLessons();
}

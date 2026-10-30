package ru.teacherbox.notifications.application;

import ru.teacherbox.shared.i18n.Language;

/**
 * Texts of the homework, billing, meeting and account notifications in each language (ADR-0036);
 * dates and amounts come formatted ({@link NotificationTexts}).
 */
enum NotificationMessages {

    RU {
        @Override String taskAssigned(String title) { return "Новое задание: «" + title + "»"; }
        @Override String dueAt(String when) { return "Срок сдачи: " + when; }
        @Override String dueSoon(String title) { return "Скоро срок сдачи: «" + title + "»"; }
        @Override String reminder(String title) { return "Учитель напоминает о задании «" + title + "»"; }
        @Override String taskAccepted(String title) { return "Задание «" + title + "» принято"; }
        @Override String grade(String grade) { return "Оценка: " + grade; }
        @Override String taskReturned(String title) { return "Задание «" + title + "» возвращено на доработку"; }
        @Override String seeTeacherComment() { return "Посмотрите комментарий учителя."; }
        @Override String toReview(String title) { return "Работа на проверку: «" + title + "»"; }
        @Override String student(String name) { return "Ученик: " + name; }
        @Override String unknownStudent() { return "Ученик"; }
        @Override String lessonRecorded(String date) { return "Занятие " + date; }
        @Override String lessonMissed(String date) { return "Пропуск занятия " + date; }
        @Override String price(String amount) { return "Стоимость: " + amount + "."; }
        @Override String chargeRemoved(String date) { return "Начисление за занятие " + date + " снято"; }
        @Override String notCharged() { return "Занятие не оплачивается."; }
        @Override String paymentRecorded(String amount) { return "Получена оплата " + amount; }
        @Override String paymentVoided(String amount) { return "Оплата " + amount + " аннулирована"; }
        @Override String meetingLink() { return "Ссылка на урок"; }
        @Override String ourLessons(String url) { return "По этой ссылке проходят наши уроки: " + url; }
        @Override String groupLessons(String group, String url) {
            return "По этой ссылке проходят уроки группы «" + group + "»: " + url;
        }
        @Override String ourRoom() { return "Здесь проходят наши уроки."; }
        @Override String groupRoom(String group) { return "Здесь проходят уроки группы «" + group + "»."; }
        @Override String open() { return "Открыть"; }
        @Override String join() { return "Подключиться"; }
        @Override String studentJoined() { return "Ученик присоединился к порталу"; }
        @Override String studentJoinedBody(String name) {
            return name + " принял(а) приглашение и теперь может войти в личный кабинет.";
        }
        @Override String connectTitle() { return "Подключите мессенджер"; }
        @Override String connectBody() {
            return "Чтобы получать уведомления в Telegram, ВКонтакте или MAX, откройте раздел «Уведомления» и нажмите "
                    + "«Подключить».";
        }
        @Override String testMessage() { return "Проверка связи: уведомления портала учителя будут приходить сюда."; }
    },

    EN {
        @Override String taskAssigned(String title) { return "New assignment: “" + title + "”"; }
        @Override String dueAt(String when) { return "Due: " + when; }
        @Override String dueSoon(String title) { return "Due soon: “" + title + "”"; }
        @Override String reminder(String title) { return "Your teacher reminds you about “" + title + "”"; }
        @Override String taskAccepted(String title) { return "Assignment accepted: “" + title + "”"; }
        @Override String grade(String grade) { return "Grade: " + grade; }
        @Override String taskReturned(String title) { return "Changes requested: “" + title + "”"; }
        @Override String seeTeacherComment() { return "Check your teacher's feedback."; }
        @Override String toReview(String title) { return "Submission ready for review: “" + title + "”"; }
        @Override String student(String name) { return "Student: " + name; }
        @Override String unknownStudent() { return "A student"; }
        @Override String lessonRecorded(String date) { return "Lesson completed: " + date; }
        @Override String lessonMissed(String date) { return "Lesson missed: " + date; }
        @Override String price(String amount) { return "Price: " + amount + "."; }
        @Override String chargeRemoved(String date) { return "Charge removed for the lesson on " + date; }
        @Override String notCharged() { return "You won't be charged for this lesson."; }
        @Override String paymentRecorded(String amount) { return "Payment received: " + amount; }
        @Override String paymentVoided(String amount) { return "Payment of " + amount + " voided"; }
        @Override String meetingLink() { return "Lesson link"; }
        @Override String ourLessons(String url) { return "Join our lessons here: " + url; }
        @Override String groupLessons(String group, String url) { return "Join lessons for “" + group + "” here: " + url; }
        @Override String ourRoom() { return "Join our lessons in this room."; }
        @Override String groupRoom(String group) { return "Join lessons for “" + group + "” in this room."; }
        @Override String open() { return "Open"; }
        @Override String join() { return "Join"; }
        @Override String studentJoined() { return "A student has joined the portal"; }
        @Override String studentJoinedBody(String name) {
            return name + " accepted the invitation and can now sign in to their account.";
        }
        @Override String connectTitle() { return "Connect a messaging app"; }
        @Override String connectBody() {
            return "To receive notifications on Telegram, VK or MAX, open your portal account's messenger "
                    + "settings and select “Connect”.";
        }
        @Override String testMessage() { return "Connection successful! You'll receive portal notifications here."; }
    };

    static NotificationMessages of(Language language) {
        return switch (language) {
            case RU -> RU;
            case EN -> EN;
        };
    }

    abstract String taskAssigned(String title);

    abstract String dueAt(String when);

    abstract String dueSoon(String title);

    abstract String reminder(String title);

    abstract String taskAccepted(String title);

    abstract String grade(String grade);

    abstract String taskReturned(String title);

    abstract String seeTeacherComment();

    abstract String toReview(String title);

    abstract String student(String name);

    abstract String unknownStudent();

    abstract String lessonRecorded(String date);

    abstract String lessonMissed(String date);

    abstract String price(String amount);

    abstract String chargeRemoved(String date);

    abstract String notCharged();

    abstract String paymentRecorded(String amount);

    abstract String paymentVoided(String amount);

    abstract String meetingLink();

    abstract String ourLessons(String url);

    abstract String groupLessons(String group, String url);

    /** The room in messengers, its address goes as a button. */
    abstract String ourRoom();

    abstract String groupRoom(String group);

    /** The button to the portal page of a notification. */
    abstract String open();

    /** The button to the video room of a notification. */
    abstract String join();

    abstract String studentJoined();

    abstract String studentJoinedBody(String name);

    abstract String connectTitle();

    abstract String connectBody();

    abstract String testMessage();
}

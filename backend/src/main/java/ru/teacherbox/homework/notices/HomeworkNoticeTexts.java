package ru.teacherbox.homework.notices;

import ru.teacherbox.shared.i18n.Language;

/** Texts of the homework notices in each language (ADR-0036); dates come formatted. */
enum HomeworkNoticeTexts {

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
    };

    static HomeworkNoticeTexts of(Language language) {
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
}

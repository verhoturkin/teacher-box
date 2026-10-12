package ru.teacherbox.notifications.application;

import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.i18n.Plural;

/**
 * Texts of the schedule notifications in each language (ADR-0036); dates and durations come formatted
 * ({@link NotificationTexts}).
 */
enum ScheduleMessages {

    RU {
        @Override String group(String name) { return "Группа «" + name + "»."; }
        @Override String groupOf(String name) { return "группа «" + name + "»"; }
        @Override String aStudent() { return "ученик"; }
        @Override String unknownStudent() { return "Ученик"; }
        @Override String topic(String topic) { return "Тема: " + topic; }
        @Override String newLesson(String when) { return "Новое занятие: " + when; }
        @Override String series(String weekly) { return "Регулярные занятия " + weekly; }
        @Override String seriesDates(String from, @Nullable String to) { return "С " + from + (to == null ? "" : " по " + to); }
        @Override String everyWeeks(int weeks) {
            return ", раз в " + weeks + " " + Plural.russian(weeks, "неделю", "недели", "недель");
        }
        @Override String seriesStopped() { return "Регулярные занятия завершены"; }
        @Override String seriesStoppedFrom(String from) { return "Занятия по расписанию с " + from + " отменены."; }
        @Override String moved(String when) { return "Занятие перенесено на " + when; }
        @Override String was(String when) { return "Было: " + when + "."; }
        @Override String reason(String reason) { return "Причина: " + reason; }
        @Override String countedAsMissed() { return "Занятие засчитано как пропуск."; }
        @Override String cancelled(String when) { return "Занятие " + when + " отменено"; }
        @Override String restored(String when) { return "Занятие " + when + " снова в расписании"; }
        @Override String cancellationWithdrawn() { return "Отмена занятия снята."; }
        @Override String requestedLesson(String when, @Nullable String group) {
            return "Занятие: " + when + (group == null ? "" : ", группа «" + group + "»") + ".";
        }
        @Override String proposes(String when) { return "Предлагает: " + when + "."; }
        @Override String lateCancellation() { return "Поздняя отмена."; }
        @Override String lateAbsence() { return "Поздно — решите, засчитать ли пропуск."; }
        @Override String comment(String comment) { return "Комментарий: " + comment; }
        @Override String asksToMove(String student) { return student + " просит перенести занятие"; }
        @Override String wontCome(String student) { return student + " не придёт на занятие группы"; }
        @Override String asksToCancel(String student) { return student + " просит отменить занятие"; }
        @Override String moveDeclined() { return "Перенос занятия не согласован"; }
        @Override String absenceDeclined() { return "Пропуск занятия не согласован"; }
        @Override String cancelDeclined() { return "Отмена занятия не согласована"; }
        @Override String lessonStays(String when) { return "Занятие остаётся: " + when + "."; }
        @Override String moveAgreed(String when) { return "Перенос согласован: " + when; }
        @Override String absenceKnown(String when) { return "Учитель знает, что вас не будет " + when; }
        @Override String cancelAgreed(String when) { return "Отмена занятия " + when + " согласована"; }
        @Override String lateCharged() { return "Отмена поздняя, занятие засчитано как пропуск."; }
        @Override String teacherComment(String comment) { return "Комментарий учителя: " + comment; }
        @Override String in(String duration) { return "Через " + duration + "."; }
        @Override String meetingLink(String url) { return "Ссылка на урок: " + url; }
        @Override String soonForStudent(String when) { return "Скоро занятие: " + when; }
        @Override String soonForTeacher(String with, String when) { return "Скоро урок: " + with + ", " + when; }
        @Override String calendarDisconnected() { return "Google Календарь отключён"; }
        @Override String calendarDisconnectedBody() {
            return "Google больше не принимает доступ портала, занятия не попадают в календарь. "
                    + "Подключите календарь заново в настройках.";
        }
    },

    EN {
        @Override String group(String name) { return "Group “" + name + "”."; }
        @Override String groupOf(String name) { return "group “" + name + "”"; }
        @Override String aStudent() { return "a student"; }
        @Override String unknownStudent() { return "A student"; }
        @Override String topic(String topic) { return "Topic: " + topic; }
        @Override String newLesson(String when) { return "New lesson: " + when; }
        @Override String series(String weekly) { return "Regular lessons " + weekly; }
        @Override String seriesDates(String from, @Nullable String to) { return "From " + from + (to == null ? "" : " to " + to); }
        @Override String everyWeeks(int weeks) { return ", every " + weeks + " weeks"; }
        @Override String seriesStopped() { return "Regular lessons ended"; }
        @Override String seriesStoppedFrom(String from) { return "Scheduled lessons from " + from + " are cancelled."; }
        @Override String moved(String when) { return "Lesson moved to " + when; }
        @Override String was(String when) { return "Was: " + when + "."; }
        @Override String reason(String reason) { return "Reason: " + reason; }
        @Override String countedAsMissed() { return "The lesson counts as missed."; }
        @Override String cancelled(String when) { return "Lesson on " + when + " cancelled"; }
        @Override String restored(String when) { return "Lesson on " + when + " is back in the schedule"; }
        @Override String cancellationWithdrawn() { return "The cancellation is withdrawn."; }
        @Override String requestedLesson(String when, @Nullable String group) {
            return "Lesson: " + when + (group == null ? "" : ", group “" + group + "”") + ".";
        }
        @Override String proposes(String when) { return "Proposes: " + when + "."; }
        @Override String lateCancellation() { return "Late cancellation."; }
        @Override String lateAbsence() { return "Late — decide whether to count it as missed."; }
        @Override String comment(String comment) { return "Comment: " + comment; }
        @Override String asksToMove(String student) { return student + " asks to move a lesson"; }
        @Override String wontCome(String student) { return student + " won't come to a group lesson"; }
        @Override String asksToCancel(String student) { return student + " asks to cancel a lesson"; }
        @Override String moveDeclined() { return "Moving the lesson is not agreed"; }
        @Override String absenceDeclined() { return "Missing the lesson is not agreed"; }
        @Override String cancelDeclined() { return "Cancelling the lesson is not agreed"; }
        @Override String lessonStays(String when) { return "The lesson stays: " + when + "."; }
        @Override String moveAgreed(String when) { return "Move agreed: " + when; }
        @Override String absenceKnown(String when) { return "The teacher knows you won't be there on " + when; }
        @Override String cancelAgreed(String when) { return "Cancelling the lesson on " + when + " is agreed"; }
        @Override String lateCharged() { return "The cancellation is late, the lesson counts as missed."; }
        @Override String teacherComment(String comment) { return "Teacher's comment: " + comment; }
        @Override String in(String duration) { return "In " + duration + "."; }
        @Override String meetingLink(String url) { return "Lesson link: " + url; }
        @Override String soonForStudent(String when) { return "Lesson soon: " + when; }
        @Override String soonForTeacher(String with, String when) { return "Lesson soon: " + with + ", " + when; }
        @Override String calendarDisconnected() { return "Google Calendar disconnected"; }
        @Override String calendarDisconnectedBody() {
            return "Google no longer accepts the portal's access, lessons don't get into the calendar. "
                    + "Connect the calendar again in the settings.";
        }
    };

    static ScheduleMessages of(Language language) {
        return switch (language) {
            case RU -> RU;
            case EN -> EN;
        };
    }

    /** «Группа «ОГЭ».» */
    abstract String group(String name);

    /** «группа «ОГЭ»», inside a sentence. */
    abstract String groupOf(String name);

    /** Who the lesson is with when the student is unknown, inside a sentence. */
    abstract String aStudent();

    abstract String unknownStudent();

    abstract String topic(String topic);

    abstract String newLesson(String when);

    abstract String series(String weekly);

    /** @param to {@code null}: no end */
    abstract String seriesDates(String from, @Nullable String to);

    abstract String everyWeeks(int weeks);

    abstract String seriesStopped();

    abstract String seriesStoppedFrom(String from);

    abstract String moved(String when);

    abstract String was(String when);

    abstract String reason(String reason);

    abstract String countedAsMissed();

    abstract String cancelled(String when);

    abstract String restored(String when);

    abstract String cancellationWithdrawn();

    /** @param group {@code null}: an individual lesson */
    abstract String requestedLesson(String when, @Nullable String group);

    abstract String proposes(String when);

    abstract String lateCancellation();

    abstract String lateAbsence();

    abstract String comment(String comment);

    abstract String asksToMove(String student);

    abstract String wontCome(String student);

    abstract String asksToCancel(String student);

    abstract String moveDeclined();

    abstract String absenceDeclined();

    abstract String cancelDeclined();

    abstract String lessonStays(String when);

    abstract String moveAgreed(String when);

    abstract String absenceKnown(String when);

    abstract String cancelAgreed(String when);

    abstract String lateCharged();

    abstract String teacherComment(String comment);

    abstract String in(String duration);

    abstract String meetingLink(String url);

    abstract String soonForStudent(String when);

    abstract String soonForTeacher(String with, String when);

    abstract String calendarDisconnected();

    abstract String calendarDisconnectedBody();
}

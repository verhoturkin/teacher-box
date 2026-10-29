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
        @Override String lessonTitle(String title) { return "Занятие «" + title + "»."; }
        @Override String topic(String topic) { return "Тема: " + topic; }
        @Override String newLesson(String when) { return "Новое занятие: " + when; }
        @Override String series(String weekly) { return "Занятия с повтором " + weekly; }
        @Override String seriesDates(String from, @Nullable String to) { return "С " + from + (to == null ? "" : " по " + to); }
        @Override String everyWeeks(int weeks) {
            return ", раз в " + weeks + " " + Plural.russian(weeks, "неделю", "недели", "недель");
        }
        @Override String seriesStopped() { return "Занятия с повтором завершены"; }
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
        @Override String lessonSummary(String date) { return "Итоги урока " + date; }
        @Override String lessonSummaryBody() { return "Учитель написал, что вы прошли на уроке."; }
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
        @Override String lessonTitle(String title) { return "Lesson “" + title + "”."; }
        @Override String topic(String topic) { return "Topic: " + topic; }
        @Override String newLesson(String when) { return "New lesson: " + when; }
        @Override String series(String weekly) { return "Recurring lessons " + weekly; }
        @Override String seriesDates(String from, @Nullable String to) { return "From " + from + (to == null ? "" : " to " + to); }
        @Override String everyWeeks(int weeks) { return ", every " + weeks + " " + Plural.english(weeks, "week", "weeks"); }
        @Override String seriesStopped() { return "Recurring lessons ended"; }
        @Override String seriesStoppedFrom(String from) { return "Lessons scheduled for " + from + " onwards have been cancelled."; }
        @Override String moved(String when) { return "Lesson rescheduled to " + when; }
        @Override String was(String when) { return "Previously: " + when + "."; }
        @Override String reason(String reason) { return "Reason: " + reason; }
        @Override String countedAsMissed() { return "This lesson has been marked as missed."; }
        @Override String cancelled(String when) { return "Lesson on " + when + " cancelled"; }
        @Override String restored(String when) { return "Lesson on " + when + " reinstated"; }
        @Override String cancellationWithdrawn() { return "The lesson has been reinstated."; }
        @Override String requestedLesson(String when, @Nullable String group) {
            return "Lesson: " + when + (group == null ? "" : ", group “" + group + "”") + ".";
        }
        @Override String proposes(String when) { return "Suggested time: " + when + "."; }
        @Override String lateCancellation() { return "Late cancellation."; }
        @Override String lateAbsence() { return "This is short notice. Decide whether to mark the lesson as missed."; }
        @Override String comment(String comment) { return "Comment: " + comment; }
        @Override String asksToMove(String student) { return student + " requested a lesson reschedule"; }
        @Override String wontCome(String student) { return student + " can't attend a group lesson"; }
        @Override String asksToCancel(String student) { return student + " requested a lesson cancellation"; }
        @Override String moveDeclined() { return "Reschedule request declined"; }
        @Override String absenceDeclined() { return "Absence request declined"; }
        @Override String cancelDeclined() { return "Cancellation request declined"; }
        @Override String lessonStays(String when) { return "The lesson is still scheduled for " + when + "."; }
        @Override String moveAgreed(String when) { return "Reschedule approved: " + when; }
        @Override String absenceKnown(String when) { return "Your teacher has acknowledged your absence on " + when + "."; }
        @Override String cancelAgreed(String when) { return "Cancellation approved for the lesson on " + when; }
        @Override String lateCharged() { return "This was a late cancellation. The lesson has been marked as missed."; }
        @Override String teacherComment(String comment) { return "Teacher's comment: " + comment; }
        @Override String in(String duration) { return "In " + duration + "."; }
        @Override String meetingLink(String url) { return "Lesson link: " + url; }
        @Override String soonForStudent(String when) { return "Upcoming lesson: " + when; }
        @Override String soonForTeacher(String with, String when) { return "Upcoming lesson: " + with + ", " + when; }
        @Override String lessonSummary(String date) { return "Lesson summary: " + date; }
        @Override String lessonSummaryBody() { return "Your teacher has shared a summary of what you covered."; }
        @Override String calendarDisconnected() { return "Google Calendar disconnected"; }
        @Override String calendarDisconnectedBody() { return "The portal no longer has access to your Google Calendar, so lessons aren't syncing. Reconnect it in Settings."; }
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

    abstract String lessonTitle(String title);

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

    abstract String lessonSummary(String date);

    abstract String lessonSummaryBody();

    abstract String calendarDisconnected();

    abstract String calendarDisconnectedBody();
}

package ru.teacherbox.schedule.application;

import ru.teacherbox.shared.i18n.Language;

/**
 * Texts of the calendars — the feed of a teacher or a student and the events in Google Calendar — in the
 * language of the calendar's owner (ADR-0036).
 */
public enum CalendarTexts {

    RU {
        @Override String teacherCalendar(String portal) { return portal + " — занятия"; }
        @Override String studentCalendar(String portal) { return "Занятия — " + portal; }
        @Override public String lessonWith(String who) { return "Урок: " + who; }
        @Override String aGroup() { return "группа"; }
        @Override public String aStudent() { return "ученик"; }
        @Override String groupLesson(String group) { return "Занятие группы «" + group + "»"; }
        @Override String lesson() { return "Занятие"; }
        @Override String cancelled() { return "Отменено: "; }
        @Override public String topic(String topic) { return "Тема: " + topic; }
        @Override public String link(String url) { return "Ссылка на урок: " + url; }
        @Override String cancelReason(String reason) { return "Причина отмены: " + reason; }
        @Override public String conducted() { return "Проведено"; }
        @Override public String missed() { return "Пропуск"; }
    },

    EN {
        @Override String teacherCalendar(String portal) { return portal + " — lessons"; }
        @Override String studentCalendar(String portal) { return "Lessons — " + portal; }
        @Override public String lessonWith(String who) { return "Lesson: " + who; }
        @Override String aGroup() { return "a group"; }
        @Override public String aStudent() { return "a student"; }
        @Override String groupLesson(String group) { return "Lesson of the group “" + group + "”"; }
        @Override String lesson() { return "Lesson"; }
        @Override String cancelled() { return "Cancelled: "; }
        @Override public String topic(String topic) { return "Topic: " + topic; }
        @Override public String link(String url) { return "Lesson link: " + url; }
        @Override String cancelReason(String reason) { return "Cancellation reason: " + reason; }
        @Override public String conducted() { return "Conducted"; }
        @Override public String missed() { return "Missed"; }
    };

    public static CalendarTexts of(Language language) {
        return switch (language) {
            case RU -> RU;
            case EN -> EN;
        };
    }

    /** The name of the teacher's feed. */
    abstract String teacherCalendar(String portal);

    /** The name of a student's feed. */
    abstract String studentCalendar(String portal);

    /** The teacher's event: «Урок: Мария». */
    public abstract String lessonWith(String who);

    abstract String aGroup();

    public abstract String aStudent();

    /** A student's event of a group lesson. */
    abstract String groupLesson(String group);

    /** A student's event of an individual lesson. */
    abstract String lesson();

    /** Before the title of a cancelled lesson. */
    abstract String cancelled();

    public abstract String topic(String topic);

    public abstract String link(String url);

    abstract String cancelReason(String reason);

    public abstract String conducted();

    public abstract String missed();
}

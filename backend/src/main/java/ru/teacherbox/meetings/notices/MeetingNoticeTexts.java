package ru.teacherbox.meetings.notices;

import ru.teacherbox.shared.i18n.Language;

/** Texts of the notice with the link of a video room in each language (ADR-0036). */
enum MeetingNoticeTexts {

    RU {
        @Override String meetingLink() { return "Ссылка на урок"; }
        @Override String ourRoom() { return "Здесь проходят наши уроки."; }
        @Override String groupRoom(String group) { return "Здесь проходят уроки группы «" + group + "»."; }
    },

    EN {
        @Override String meetingLink() { return "Lesson link"; }
        @Override String ourRoom() { return "Join our lessons in this room."; }
        @Override String groupRoom(String group) { return "Join lessons for “" + group + "” in this room."; }
    };

    static MeetingNoticeTexts of(Language language) {
        return switch (language) {
            case RU -> RU;
            case EN -> EN;
        };
    }

    abstract String meetingLink();

    /** The room: its address goes as a button in messengers, the inbox opens the schedule. */
    abstract String ourRoom();

    abstract String groupRoom(String group);
}

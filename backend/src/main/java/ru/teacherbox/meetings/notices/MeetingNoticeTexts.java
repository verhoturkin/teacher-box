package ru.teacherbox.meetings.notices;

import ru.teacherbox.shared.i18n.Language;

/** Texts of the notice with the link of a video room in each language (ADR-0036). */
enum MeetingNoticeTexts {

    RU {
        @Override String meetingLink() { return "Ссылка на урок"; }
        @Override String ourRoom() { return "Здесь проходят наши уроки."; }
        @Override String groupRoom(String group) { return "Здесь проходят уроки группы «" + group + "»."; }
        @Override String lessonStarted() { return "Урок начался"; }
        @Override String waitingForYou() { return "Учитель ждёт вас в звонке."; }
        @Override String waitingForYouInGroup(String group) { return "Учитель ждёт вас в звонке группы «" + group + "»."; }
    },

    EN {
        @Override String meetingLink() { return "Lesson link"; }
        @Override String ourRoom() { return "Join our lessons in this room."; }
        @Override String groupRoom(String group) { return "Join lessons for “" + group + "” in this room."; }
        @Override String lessonStarted() { return "Your lesson has started"; }
        @Override String waitingForYou() { return "Your teacher is waiting for you in the call."; }
        @Override String waitingForYouInGroup(String group) { return "Your teacher is waiting for you in the “" + group + "” call."; }
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

    /** «Позвать»: the teacher is in the call of a running lesson. */
    abstract String lessonStarted();

    abstract String waitingForYou();

    abstract String waitingForYouInGroup(String group);
}

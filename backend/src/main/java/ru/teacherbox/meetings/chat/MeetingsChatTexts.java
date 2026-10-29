package ru.teacherbox.meetings.chat;

import ru.teacherbox.shared.i18n.Language;

/** Texts of the meetings actions of the bot in each language (ADR-0036). */
enum MeetingsChatTexts {

    RU {
        @Override String joinLesson() { return "Войти на урок"; }
        @Override String noLink() { return "Ссылки на видеовстречу пока нет — учитель пришлёт её перед уроком."; }
        @Override String link() { return "Ссылка на урок:"; }
        @Override String links() { return "Ссылки на уроки:"; }
        @Override String group(String name) { return "Группа «" + name + "»"; }
    },

    EN {
        @Override String joinLesson() { return "Join lesson"; }
        @Override String noLink() { return "Your teacher hasn't shared a lesson link yet. They'll send it before the lesson."; }
        @Override String link() { return "Lesson link:"; }
        @Override String links() { return "Lesson links:"; }
        @Override String group(String name) { return "Group “" + name + "”"; }
    };

    static MeetingsChatTexts of(Language language) {
        return switch (language) {
            case RU -> RU;
            case EN -> EN;
        };
    }

    abstract String joinLesson();

    abstract String noLink();

    abstract String link();

    abstract String links();

    abstract String group(String name);
}

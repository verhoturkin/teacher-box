package ru.teacherbox.boards.chat;

import ru.teacherbox.shared.i18n.Language;

/** Texts of the boards actions of the bot in each language (ADR-0036). */
enum BoardsChatTexts {

    RU {
        @Override String myBoards() { return "Мои доски"; }
        @Override String noBoards() { return "Досок пока нет."; }
        @Override String yourBoards() { return "Ваши доски:"; }
        @Override String openInCabinet() { return "Доски открываются в личном кабинете портала."; }
    },

    EN {
        @Override String myBoards() { return "My boards"; }
        @Override String noBoards() { return "No boards yet."; }
        @Override String yourBoards() { return "Your boards:"; }
        @Override String openInCabinet() { return "Open the portal to view your boards."; }
    };

    static BoardsChatTexts of(Language language) {
        return switch (language) {
            case RU -> RU;
            case EN -> EN;
        };
    }

    abstract String myBoards();

    abstract String noBoards();

    abstract String yourBoards();

    abstract String openInCabinet();
}

package ru.teacherbox.identity.notices;

import ru.teacherbox.shared.i18n.Language;

/** Texts of the account notices in each language (ADR-0036). */
enum IdentityNoticeTexts {

    RU {
        @Override String studentJoined() { return "Ученик присоединился к порталу"; }
        @Override String studentJoinedBody(String name) {
            return name + " принял(а) приглашение и теперь может войти в личный кабинет.";
        }
    },

    EN {
        @Override String studentJoined() { return "A student has joined the portal"; }
        @Override String studentJoinedBody(String name) {
            return name + " accepted the invitation and can now sign in to their account.";
        }
    };

    static IdentityNoticeTexts of(Language language) {
        return switch (language) {
            case RU -> RU;
            case EN -> EN;
        };
    }

    abstract String studentJoined();

    abstract String studentJoinedBody(String name);
}

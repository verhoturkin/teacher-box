package ru.teacherbox.shared.chat;

import java.time.format.DateTimeFormatter;
import java.util.Locale;
import ru.teacherbox.shared.i18n.Language;

/** The words of the dialogs' building blocks ({@link ChatKit}, {@link ChatPicker}, {@link ChatText}) in each language. */
enum ChatWords {

    RU {
        @Override String yes() { return "Да"; }
        @Override String no() { return "Нет"; }
        @Override String back() { return "‹ Назад"; }
        @Override String more() { return "Ещё ›"; }
        @Override String gone(String prompt) { return "Этого варианта уже нет. " + prompt; }
        @Override String nothingFound(String query, String prompt) {
            return "По запросу «" + query + "» ничего не нашлось. " + prompt;
        }
        @Override String severalFound(String prompt) { return "Нашлось несколько. " + prompt; }
        @Override String typePartOfName() { return "Можно написать часть имени."; }
    },

    EN {
        @Override String yes() { return "Yes"; }
        @Override String no() { return "No"; }
        @Override String back() { return "‹ Back"; }
        @Override String more() { return "More ›"; }
        @Override String gone(String prompt) { return "This option is gone. " + prompt; }
        @Override String nothingFound(String query, String prompt) {
            return "Nothing found for “" + query + "”. " + prompt;
        }
        @Override String severalFound(String prompt) { return "Several found. " + prompt; }
        @Override String typePartOfName() { return "You can type a part of the name."; }
    };

    static ChatWords of(Language language) {
        return switch (language) {
            case RU -> RU;
            case EN -> EN;
        };
    }

    /** «пн 29.09», «Mon 29.09». */
    DateTimeFormatter dateLabel() {
        return DateTimeFormatter.ofPattern("EE dd.MM", locale());
    }

    /** «пн 29.09, 18:30». */
    DateTimeFormatter dayTime() {
        return DateTimeFormatter.ofPattern("EE dd.MM, HH:mm", locale());
    }

    /** «пн 29.09 18:30», for buttons. */
    DateTimeFormatter shortDayTime() {
        return DateTimeFormatter.ofPattern("EE dd.MM HH:mm", locale());
    }

    private Locale locale() {
        return Language.valueOf(name()).locale();
    }

    abstract String yes();

    abstract String no();

    abstract String back();

    abstract String more();

    abstract String gone(String prompt);

    abstract String nothingFound(String query, String prompt);

    abstract String severalFound(String prompt);

    abstract String typePartOfName();
}

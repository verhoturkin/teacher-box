package ru.teacherbox.platform.settings;

import java.util.Objects;
import ru.teacherbox.shared.i18n.Language;

/** A text of the settings catalog in each language of the interface (ADR-0036). */
public record Wording(String ru, String en) {

    public Wording {
        Objects.requireNonNull(ru, "ru");
        Objects.requireNonNull(en, "en");
    }

    public String in(Language language) {
        return switch (language) {
            case RU -> ru;
            case EN -> en;
        };
    }
}

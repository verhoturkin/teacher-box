package ru.teacherbox.shared.notice;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.i18n.Language;

/**
 * A notice in one language.
 *
 * @param title the title, shown everywhere
 * @param body the text under the title in the inbox; {@code null} — no text
 * @param roomBody the text under the title in messengers when the notice has a room
 *                 ({@link NoticeRequested#joinUrl()}): the address goes as a button there, so this
 *                 text has none; {@code null} — only the title. Not used without a room.
 */
public record NoticeText(String title, @Nullable String body, @Nullable String roomBody) {

    public NoticeText {
        Objects.requireNonNull(title, "title");
    }

    /** A notice without a room: messengers get the same text as the inbox. */
    public NoticeText(String title, @Nullable String body) {
        this(title, body, null);
    }

    /** The same notice written in every language. */
    public static Map<Language, NoticeText> inEveryLanguage(Function<Language, NoticeText> write) {
        Map<Language, NoticeText> texts = new EnumMap<>(Language.class);
        for (Language language : Language.values()) {
            texts.put(language, write.apply(language));
        }
        return texts;
    }
}

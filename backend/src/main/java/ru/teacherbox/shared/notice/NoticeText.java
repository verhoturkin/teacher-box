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
 * @param body the text under the title, the same in the inbox and in messengers; {@code null} — no
 *             text. It holds no address: the portal page goes as the notice's link and the video
 *             room as {@link NoticeRequested#joinUrl()}
 */
public record NoticeText(String title, @Nullable String body) {

    public NoticeText {
        Objects.requireNonNull(title, "title");
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

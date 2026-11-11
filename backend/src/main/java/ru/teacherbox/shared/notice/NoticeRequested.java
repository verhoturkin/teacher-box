package ru.teacherbox.shared.notice;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.shared.i18n.Language;

/**
 * A module asks to notify a user (ADR-0061). Published in the transaction of the change the notice
 * is about, so the two are saved or dropped together; {@code notifications} picks the text in the
 * recipient's language, puts it into the inbox and delivers it by the recipient's preferences.
 *
 * @param id the notice itself: an event delivered again does not notify twice
 * @param recipientId the teacher or a student
 * @param kind the name of a {@link NoticeKind}
 * @param texts the notice in every {@link Language}
 * @param link path inside the portal the notice refers to
 * @param subject what the notice is about, for the buttons of the bot's actions
 * @param joinUrl the video room of the notice: messengers show it as a button and take
 *                {@link NoticeText#roomBody()} for the text
 */
public record NoticeRequested(
        UUID id,
        UUID recipientId,
        String kind,
        Map<Language, NoticeText> texts,
        @Nullable String link,
        @Nullable ChatSubject subject,
        @Nullable String joinUrl) {

    public NoticeRequested {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(recipientId, "recipientId");
        Objects.requireNonNull(kind, "kind");
        texts = Map.copyOf(texts);
        for (Language language : Language.values()) {
            if (!texts.containsKey(language)) {
                throw new IllegalArgumentException("A notice needs its text in " + language);
            }
        }
    }

    /** A notice with a new id, written in every language. */
    public static NoticeRequested of(UUID recipientId, NoticeKind kind, Function<Language, NoticeText> write,
            @Nullable String link) {
        return new NoticeRequested(Ids.newId(), recipientId, kind.name(), NoticeText.inEveryLanguage(write), link,
                null, null);
    }

    /** The same notice with the buttons of the bot's actions about this subject. */
    public NoticeRequested about(@Nullable ChatSubject subject) {
        return new NoticeRequested(id, recipientId, kind, texts, link, subject, joinUrl);
    }

    /** The same notice with a video room. */
    public NoticeRequested withRoom(@Nullable String joinUrl) {
        return new NoticeRequested(id, recipientId, kind, texts, link, subject, joinUrl);
    }

    /** The notice in this language. */
    public NoticeText text(Language language) {
        return Objects.requireNonNull(texts.get(language), "text");
    }
}

package ru.teacherbox.testing.notices;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.notice.NoticeText;

/**
 * The notices of a module's samples as text, compared with {@code src/test/resources/notices/<module>.txt}.
 * The files were written by the listeners of {@code notifications} before the modules took the texts
 * over (ADR-0061, stage 380), so a module writes what was written before: every recipient, kind,
 * title, text, link, bot subject and room, in each language.
 *
 * <p>A deliberate change of a text rewrites the file: {@code -Dnotices.golden=write}.
 */
public final class NoticeGolden {

    /** One notice in one language. */
    public record Line(UUID recipientId, String kind, String title, @Nullable String body, @Nullable String link,
            @Nullable ChatSubject subject, @Nullable String joinUrl, @Nullable String roomBody) {

        public static Line of(NoticeRequested notice, Language language) {
            NoticeText text = notice.text(language);
            return new Line(notice.recipientId(), notice.kind(), text.title(), text.body(), notice.link(),
                    notice.subject(), notice.joinUrl(), text.roomBody());
        }
    }

    /** An event of a module and what it is a sample of. */
    public record Sample(String label, Object event) {
    }

    private final StringBuilder written = new StringBuilder();

    /** The notices one sample gave in one language, in the order they were written. */
    public void add(Language language, Sample sample, List<Line> lines) {
        written.append("## ").append(sample.label()).append(" [").append(language).append("]\n");
        if (lines.isEmpty()) {
            written.append("(nothing)\n");
        }
        for (Line line : lines) {
            written.append("to: ").append(SamplePeople.name(line.recipientId())).append('\n');
            written.append("kind: ").append(line.kind()).append('\n');
            written.append("title: ").append(line.title()).append('\n');
            field("body", line.body());
            field("link", line.link());
            field("subject", line.subject() == null ? null : line.subject().type() + " " + line.subject().id());
            field("room", line.joinUrl());
            field("room body", line.roomBody());
            written.append("--\n");
        }
        written.append('\n');
    }

    public void assertMatches(String module) {
        String resource = "notices/" + module + ".txt";
        if ("write".equals(System.getProperty("notices.golden"))) {
            try {
                Files.writeString(Path.of("src/test/resources", resource), written.toString());
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
            return;
        }
        try (InputStream stored = NoticeGolden.class.getClassLoader().getResourceAsStream(resource)) {
            assertThat(stored).as(resource).isNotNull();
            assertThat(written.toString()).isEqualTo(new String(stored.readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Calls the listener's {@code on(<event>)}, as the event publisher would. */
    public static void deliver(Object listener, Object event) {
        try {
            Method on = listener.getClass().getDeclaredMethod("on", event.getClass());
            on.setAccessible(true);
            on.invoke(listener, event);
        } catch (InvocationTargetException e) {
            throw new IllegalStateException(e.getCause());
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    private void field(String name, @Nullable String value) {
        if (value != null) {
            written.append(name).append(": ").append(value).append('\n');
        }
    }
}

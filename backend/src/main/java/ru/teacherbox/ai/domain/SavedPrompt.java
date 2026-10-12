package ru.teacherbox.ai.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/** A prompt of the teacher's library, reused for drafts of homework. */
public final class SavedPrompt {

    public static final int MAX_TITLE = 100;
    public static final int MAX_TEXT = 4_000;

    private final UUID id;
    private String title;
    private String text;
    private @Nullable HomeworkKind kind;
    private final Instant createdAt;
    private Instant updatedAt;
    private long version;

    private SavedPrompt(UUID id, String title, String text, @Nullable HomeworkKind kind, Instant createdAt,
            Instant updatedAt, long version) {
        this.id = Objects.requireNonNull(id);
        this.title = title;
        this.text = text;
        this.kind = kind;
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = Objects.requireNonNull(updatedAt);
        this.version = version;
    }

    /** @param kind {@code null} — for any kind */
    public static SavedPrompt create(UUID id, String title, String text, @Nullable HomeworkKind kind, Instant now) {
        return new SavedPrompt(id, valid(title, MAX_TITLE, "ai.prompt-title-invalid"),
                valid(text, MAX_TEXT, "ai.prompt-text-invalid"), kind, now, now, 0);
    }

    public static SavedPrompt restore(UUID id, String title, String text, @Nullable HomeworkKind kind,
            Instant createdAt, Instant updatedAt, long version) {
        return new SavedPrompt(id, title, text, kind, createdAt, updatedAt, version);
    }

    public void update(String newTitle, String newText, @Nullable HomeworkKind newKind, Instant now) {
        title = valid(newTitle, MAX_TITLE, "ai.prompt-title-invalid");
        text = valid(newText, MAX_TEXT, "ai.prompt-text-invalid");
        kind = newKind;
        updatedAt = now;
    }

    /** Called by the repository after the prompt has been saved with a new version. */
    public void markSaved(long newVersion) {
        version = newVersion;
    }

    private static String valid(String value, int max, String code) {
        String stripped = value.strip();
        if (stripped.isEmpty() || stripped.length() > max) {
            throw new BusinessRuleException(code, "Must be 1-" + max + " characters long");
        }
        return stripped;
    }

    public UUID id() {
        return id;
    }

    public String title() {
        return title;
    }

    public String text() {
        return text;
    }

    public @Nullable HomeworkKind kind() {
        return kind;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public long version() {
        return version;
    }
}

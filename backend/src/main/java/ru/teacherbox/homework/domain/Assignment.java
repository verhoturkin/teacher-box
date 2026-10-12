package ru.teacherbox.homework.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * Homework created by the teacher: a text (Markdown) with optional files and deadline; an interactive one also keeps
 * its HTML page (ADR-0040).
 */
public final class Assignment {

    public static final int MAX_TITLE = 200;
    public static final int MAX_DESCRIPTION = 20_000;
    public static final int MAX_HTML = 200_000;

    private final UUID id;
    private final AssignmentKind kind;
    private String title;
    private @Nullable String description;
    private @Nullable String interactiveHtml;
    private @Nullable Instant dueAt;
    private final Instant createdAt;
    private Instant updatedAt;
    private long version;

    private Assignment(UUID id, AssignmentKind kind, String title, @Nullable String description,
            @Nullable String interactiveHtml, @Nullable Instant dueAt, Instant createdAt, Instant updatedAt,
            long version) {
        this.id = Objects.requireNonNull(id);
        this.kind = Objects.requireNonNull(kind);
        this.title = title;
        this.description = description;
        this.interactiveHtml = interactiveHtml;
        this.dueAt = dueAt;
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = Objects.requireNonNull(updatedAt);
        this.version = version;
    }

    /** @param interactiveHtml the page of an interactive assignment; ignored for other kinds */
    public static Assignment create(UUID id, AssignmentKind kind, String title, @Nullable String description,
            @Nullable String interactiveHtml, @Nullable Instant dueAt, Instant now) {
        return new Assignment(id, kind, validTitle(title), validDescription(description),
                validHtml(kind, interactiveHtml), dueAt, now, now, 0);
    }

    public static Assignment restore(UUID id, AssignmentKind kind, String title, @Nullable String description,
            @Nullable String interactiveHtml, @Nullable Instant dueAt, Instant createdAt, Instant updatedAt,
            long version) {
        return new Assignment(id, kind, title, description, interactiveHtml, dueAt, createdAt, updatedAt, version);
    }

    /** @param newHtml the page of an interactive assignment; ignored for other kinds */
    public void update(String newTitle, @Nullable String newDescription, @Nullable String newHtml,
            @Nullable Instant newDueAt, Instant now) {
        title = validTitle(newTitle);
        description = validDescription(newDescription);
        interactiveHtml = validHtml(kind, newHtml);
        dueAt = newDueAt;
        updatedAt = now;
    }

    /** Textbooks and files belong to written homework only. */
    public boolean allowsMaterials() {
        return kind == AssignmentKind.WRITTEN;
    }

    /** Called by the repository after the assignment has been saved with a new version. */
    public void markSaved(long newVersion) {
        version = newVersion;
    }

    private static String validTitle(String title) {
        String trimmed = title.trim();
        if (trimmed.isEmpty() || trimmed.length() > MAX_TITLE) {
            throw new BusinessRuleException("assignment.title-invalid",
                    "Title must be 1-" + MAX_TITLE + " characters long");
        }
        return trimmed;
    }

    private static @Nullable String validDescription(@Nullable String description) {
        if (description == null || description.isBlank()) {
            return null;
        }
        if (description.length() > MAX_DESCRIPTION) {
            throw new BusinessRuleException("assignment.description-invalid", "Description is too long");
        }
        return description.strip();
    }

    private static @Nullable String validHtml(AssignmentKind kind, @Nullable String html) {
        if (kind != AssignmentKind.INTERACTIVE) {
            return null;
        }
        if (html == null || html.isBlank()) {
            throw new BusinessRuleException("assignment.html-required", "Interactive homework needs its HTML page");
        }
        if (html.length() > MAX_HTML) {
            throw new BusinessRuleException("assignment.html-invalid", "The HTML page is too long");
        }
        return html;
    }

    public UUID id() {
        return id;
    }

    public AssignmentKind kind() {
        return kind;
    }

    public String title() {
        return title;
    }

    public @Nullable String description() {
        return description;
    }

    public @Nullable String interactiveHtml() {
        return interactiveHtml;
    }

    public @Nullable Instant dueAt() {
        return dueAt;
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

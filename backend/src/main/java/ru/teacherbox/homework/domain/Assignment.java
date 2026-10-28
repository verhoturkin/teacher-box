package ru.teacherbox.homework.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.homework.domain.quiz.RevealRule;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * Homework created by the teacher: a text (Markdown) with optional files and deadline; the board it was put on, if
 * any (ADR-0041).
 */
public final class Assignment {

    public static final int MAX_TITLE = 200;
    public static final int MAX_DESCRIPTION = 20_000;
    public static final int MAX_QUIZ_ATTEMPTS = 50;
    public static final RevealRule DEFAULT_REVEAL = RevealRule.AFTER_SUBMIT;
    public static final int DEFAULT_ATTEMPTS = 1;

    private final UUID id;
    private String title;
    private @Nullable String description;
    private @Nullable Instant dueAt;
    private @Nullable UUID boardId;
    private RevealRule quizReveal;
    private @Nullable Integer quizAttempts;
    private final Instant createdAt;
    private Instant updatedAt;
    private long version;

    private Assignment(UUID id, String title, @Nullable String description, @Nullable Instant dueAt,
            @Nullable UUID boardId, RevealRule quizReveal, @Nullable Integer quizAttempts, Instant createdAt,
            Instant updatedAt, long version) {
        this.id = Objects.requireNonNull(id);
        this.title = title;
        this.description = description;
        this.dueAt = dueAt;
        this.boardId = boardId;
        this.quizReveal = quizReveal;
        this.quizAttempts = quizAttempts;
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = Objects.requireNonNull(updatedAt);
        this.version = version;
    }

    public static Assignment create(UUID id, String title, @Nullable String description, @Nullable Instant dueAt,
            Instant now) {
        return new Assignment(id, validTitle(title), validDescription(description), dueAt, null, DEFAULT_REVEAL,
                DEFAULT_ATTEMPTS, now, now, 0);
    }

    public static Assignment restore(UUID id, String title, @Nullable String description, @Nullable Instant dueAt,
            @Nullable UUID boardId, RevealRule quizReveal, @Nullable Integer quizAttempts, Instant createdAt,
            Instant updatedAt, long version) {
        return new Assignment(id, title, description, dueAt, boardId, quizReveal, quizAttempts, createdAt, updatedAt,
                version);
    }

    /** A draft made from this assignment: the same text, no deadline and no board. */
    public Assignment copy(UUID newId, String suffix, Instant now) {
        String copyTitle = title.length() + suffix.length() > MAX_TITLE
                ? title.substring(0, MAX_TITLE - suffix.length()).stripTrailing() + suffix
                : title + suffix;
        return new Assignment(newId, copyTitle, description, null, null, quizReveal, quizAttempts, now, now, 0);
    }

    public void update(String newTitle, @Nullable String newDescription, @Nullable Instant newDueAt, Instant now) {
        title = validTitle(newTitle);
        description = validDescription(newDescription);
        dueAt = newDueAt;
        updatedAt = now;
    }

    /**
     * @param reveal   {@code null} — keep
     * @param attempts attempts a student may make, 0 — unlimited; {@code null} — keep
     */
    public void changeQuiz(@Nullable RevealRule reveal, @Nullable Integer attempts) {
        if (reveal != null) {
            quizReveal = reveal;
        }
        if (attempts != null) {
            if (attempts < 0 || attempts > MAX_QUIZ_ATTEMPTS) {
                throw new BusinessRuleException("homework.quiz-attempts-invalid",
                        "Attempts must be 0 (unlimited) or 1.." + MAX_QUIZ_ATTEMPTS);
            }
            quizAttempts = attempts == 0 ? null : attempts;
        }
    }

    /** The assignment was put on this board (the student gets «Перейти на доску»); {@code null} forgets it. */
    public void placeOnBoard(@Nullable UUID board) {
        boardId = board;
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

    public UUID id() {
        return id;
    }

    public String title() {
        return title;
    }

    public @Nullable String description() {
        return description;
    }

    public @Nullable Instant dueAt() {
        return dueAt;
    }

    public @Nullable UUID boardId() {
        return boardId;
    }

    public RevealRule quizReveal() {
        return quizReveal;
    }

    /** {@code null} — unlimited. */
    public @Nullable Integer quizAttempts() {
        return quizAttempts;
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

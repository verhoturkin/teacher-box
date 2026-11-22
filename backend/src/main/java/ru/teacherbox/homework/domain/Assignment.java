package ru.teacherbox.homework.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.homework.domain.quiz.RevealRule;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;

/**
 * Homework created by the teacher: a text (Markdown) with optional files and deadline; the board it was put on, if
 * any (ADR-0041); the course it belongs to, if any (ADR-0071).
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
    private @Nullable UUID courseId;
    private RevealRule quizReveal;
    private @Nullable Integer quizAttempts;
    private final boolean bank;
    private @Nullable UUID sourceId;
    private final Instant createdAt;
    private Instant updatedAt;
    private long version;

    private Assignment(UUID id, String title, @Nullable String description, @Nullable Instant dueAt,
            @Nullable UUID boardId, @Nullable UUID courseId, RevealRule quizReveal, @Nullable Integer quizAttempts,
            boolean bank, @Nullable UUID sourceId, Instant createdAt, Instant updatedAt, long version) {
        this.id = Objects.requireNonNull(id);
        this.bank = bank;
        this.sourceId = sourceId;
        this.title = title;
        this.description = description;
        this.dueAt = dueAt;
        this.boardId = boardId;
        this.courseId = courseId;
        this.quizReveal = quizReveal;
        this.quizAttempts = quizAttempts;
        this.createdAt = Objects.requireNonNull(createdAt);
        this.updatedAt = Objects.requireNonNull(updatedAt);
        this.version = version;
    }

    /** A working assignment. */
    public static Assignment create(UUID id, String title, @Nullable String description, @Nullable Instant dueAt,
            Instant now) {
        return create(id, title, description, dueAt, false, now);
    }

    /** @param bank a bank item (roadmap 11): content only, it gets no deadline */
    public static Assignment create(UUID id, String title, @Nullable String description, @Nullable Instant dueAt,
            boolean bank, Instant now) {
        return new Assignment(id, validTitle(title), validDescription(description), bank ? null : dueAt, null, null,
                DEFAULT_REVEAL, DEFAULT_ATTEMPTS, bank, null, now, now, 0);
    }

    public static Assignment restore(UUID id, String title, @Nullable String description, @Nullable Instant dueAt,
            @Nullable UUID boardId, @Nullable UUID courseId, RevealRule quizReveal, @Nullable Integer quizAttempts,
            boolean bank, @Nullable UUID sourceId, Instant createdAt, Instant updatedAt, long version) {
        return new Assignment(id, title, description, dueAt, boardId, courseId, quizReveal, quizAttempts, bank,
                sourceId, createdAt, updatedAt, version);
    }

    /**
     * A draft made from this assignment: the same text and course, no deadline and no board, no source. A copy of a
     * bank item stays in the bank.
     */
    public Assignment copy(UUID newId, String suffix, Instant now) {
        String copyTitle = title.length() + suffix.length() > MAX_TITLE
                ? title.substring(0, MAX_TITLE - suffix.length()).stripTrailing() + suffix
                : title + suffix;
        return new Assignment(newId, copyTitle, description, null, null, courseId, quizReveal, quizAttempts, bank, null,
                now, now, 0);
    }

    /** The bank original of this working assignment (roadmap 11 «Bank»): its content, no deadline and no board. */
    public Assignment original(UUID newId, Instant now) {
        return new Assignment(newId, title, description, null, null, courseId, quizReveal, quizAttempts, true, null,
                now, now, 0);
    }

    /** «Использовать»: a working draft of this bank item, its source is this item. */
    public Assignment use(UUID newId, Instant now) {
        return new Assignment(newId, title, description, null, null, courseId, quizReveal, quizAttempts, false, id,
                now, now, 0);
    }

    /** «Обновить в банке»: this original takes the content of its working assignment. */
    public void replaceContent(Assignment working, Instant now) {
        title = working.title;
        description = working.description;
        courseId = working.courseId;
        quizReveal = working.quizReveal;
        quizAttempts = working.quizAttempts;
        updatedAt = now;
    }

    /** The bank item this working assignment was saved as. */
    public void saveAs(UUID original) {
        sourceId = original;
    }

    /** A bank item keeps no deadline. */
    public void update(String newTitle, @Nullable String newDescription, @Nullable Instant newDueAt, Instant now) {
        title = validTitle(newTitle);
        description = validDescription(newDescription);
        dueAt = bank ? null : newDueAt;
        updatedAt = now;
    }

    /**
     * A bank item is never given out, put on a board or kept for students (409 {@code homework.bank-item}).
     */
    public void requireWorking() {
        if (bank) {
            throw new ConflictException("homework.bank-item", "A bank item is never given out");
        }
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

    /** The course of the assignment (checked by the caller); {@code null} — none. */
    public void changeCourse(@Nullable UUID course) {
        courseId = course;
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

    public @Nullable UUID courseId() {
        return courseId;
    }

    public RevealRule quizReveal() {
        return quizReveal;
    }

    /** {@code null} — unlimited. */
    public @Nullable Integer quizAttempts() {
        return quizAttempts;
    }

    /** A bank item (roadmap 11): an original kept for reuse. */
    public boolean bank() {
        return bank;
    }

    /** The bank item it came from or was saved as; {@code null} — none. */
    public @Nullable UUID sourceId() {
        return sourceId;
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

package ru.teacherbox.homework.domain;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * One attempt of a student to hand in a task. All attempts are kept.
 *
 * @param text the answer text of written homework (optional when files are attached)
 * @param result what the page of interactive homework reported
 */
public record Submission(UUID id, UUID taskId, @Nullable String text, @Nullable InteractiveResult result,
        Instant submittedAt) {

    public static final int MAX_TEXT = 20_000;

    public static Submission create(UUID id, UUID taskId, @Nullable String text, boolean hasFiles, Instant now) {
        String normalized = text == null || text.isBlank() ? null : text.strip();
        if (normalized == null && !hasFiles) {
            throw new BusinessRuleException("submission.empty", "Write an answer or attach a file");
        }
        if (normalized != null && normalized.length() > MAX_TEXT) {
            throw new BusinessRuleException("submission.text-invalid", "The answer is too long");
        }
        return new Submission(id, taskId, normalized, null, now);
    }

    /** Homework on a board or interactive homework marked done, with the result of an interactive page. */
    public static Submission done(UUID id, UUID taskId, @Nullable InteractiveResult result, Instant now) {
        return new Submission(id, taskId, null, result, now);
    }
}

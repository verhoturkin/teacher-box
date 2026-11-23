package ru.teacherbox.textbooks.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * A lesson plan (ADR-0071): a Markdown plan with textbook pages and videos.
 *
 * @param courseId the course of the plan; {@code null} — none
 * @param bank     an original kept in the bank for reuse; else a working plan of one lesson
 * @param sourceId the bank item a working plan came from or was saved as; {@code null} — none (never a bank item's)
 */
public record LessonPlan(UUID id, String title, String body, @Nullable UUID courseId, boolean bank,
        @Nullable UUID sourceId, Instant createdAt, Instant updatedAt, long version) {

    public static final int MAX_TITLE = 200;
    public static final int MAX_BODY = 20_000;

    public LessonPlan {
        Objects.requireNonNull(id);
        Objects.requireNonNull(createdAt);
        Objects.requireNonNull(updatedAt);
        title = title == null ? "" : title.strip();
        body = body == null ? "" : body.strip();
        if (title.isEmpty() || title.length() > MAX_TITLE) {
            throw new BusinessRuleException("textbooks.plan-title-invalid",
                    "The plan title must be 1-" + MAX_TITLE + " characters");
        }
        if (body.length() > MAX_BODY) {
            throw new BusinessRuleException("textbooks.plan-body-too-long",
                    "The plan text must be at most " + MAX_BODY + " characters");
        }
        if (bank && sourceId != null) {
            throw new IllegalArgumentException("A bank item has no source");
        }
    }

    /** The same plan with this content. */
    public LessonPlan withContent(String newTitle, String newBody, @Nullable UUID newCourseId, Instant at) {
        return new LessonPlan(id, newTitle, newBody, newCourseId, bank, sourceId, createdAt, at, version);
    }

    /** A new plan with this one's content: a bank original ({@code source} null) or a working copy of it. */
    public LessonPlan copy(UUID copyId, boolean toBank, @Nullable UUID source, Instant at) {
        return new LessonPlan(copyId, title, body, courseId, toBank, source, at, at, 0);
    }
}

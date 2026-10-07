package ru.teacherbox.homework.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A textbook bound to an assignment (ADR-0033).
 *
 * @param pages the normalized pages ({@code 1-3, 7}); {@code null} — the whole textbook
 */
public record BoundTextbook(UUID assignmentId, UUID textbookId, @Nullable String pages, Instant boundAt) {

    public BoundTextbook {
        Objects.requireNonNull(assignmentId);
        Objects.requireNonNull(textbookId);
        Objects.requireNonNull(boundAt);
    }
}

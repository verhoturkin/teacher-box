package ru.teacherbox.textbooks.domain;

import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A textbook of a lesson plan, the rules of homework's bound textbooks (ADR-0033).
 *
 * @param pages the normalized pages ({@code 1-3, 7}); {@code null} — the whole textbook
 */
public record PlanTextbook(UUID planId, UUID textbookId, int position, @Nullable String pages) {

    public PlanTextbook {
        Objects.requireNonNull(planId);
        Objects.requireNonNull(textbookId);
    }
}

package ru.teacherbox.textbooks.api;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A textbook as other modules see it.
 *
 * @param courseId   the course of the textbook (ADR-0071); {@code null} — none
 * @param courseName its name
 * @param pageCount the number of pages; {@code null} when unknown (a document without the teacher's count)
 */
public record TextbookSummary(UUID id, TextbookKind kind, String title, @Nullable UUID courseId,
        @Nullable String courseName,
        TextbookFormat format, @Nullable Integer pageCount) {
}

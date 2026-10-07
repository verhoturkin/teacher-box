package ru.teacherbox.textbooks.api;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A textbook as other modules see it.
 *
 * @param pageCount the number of pages; {@code null} when unknown (a document without the teacher's count)
 */
public record TextbookSummary(UUID id, TextbookKind kind, String title, @Nullable String course,
        TextbookFormat format, @Nullable Integer pageCount) {
}

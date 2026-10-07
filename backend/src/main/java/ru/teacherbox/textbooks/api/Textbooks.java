package ru.teacherbox.textbooks.api;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Read-only access to textbooks for other modules (ADR-0033); access to them is checked by the caller. */
public interface Textbooks {

    Optional<TextbookSummary> find(UUID textbookId);

    /** Summaries of the given textbooks; deleted ones are skipped. */
    List<TextbookSummary> find(Collection<UUID> textbookIds);

    /**
     * The file of a textbook for the given pages: a PDF cut to the pages (those beyond its end are skipped),
     * any other file whole.
     *
     * @throws ru.teacherbox.shared.error.NotFoundException if there is no such textbook
     */
    TextbookContent content(UUID textbookId, PageRanges pages);
}

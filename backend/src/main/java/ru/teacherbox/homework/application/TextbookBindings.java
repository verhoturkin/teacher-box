package ru.teacherbox.homework.application;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import ru.teacherbox.homework.application.HomeworkViews.BoundTextbookView;
import ru.teacherbox.homework.domain.BoundTextbook;
import ru.teacherbox.homework.persistence.BoundTextbookRepository;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.textbooks.api.PageRanges;
import ru.teacherbox.textbooks.api.TextbookContent;
import ru.teacherbox.textbooks.api.TextbookSummary;
import ru.teacherbox.textbooks.api.Textbooks;

/**
 * Textbooks of assignments (ADR-0033): bound by pages, shown with the assignment, handed to the student cut to
 * the pages. A deleted textbook disappears from its assignments.
 */
@Component
class TextbookBindings {

    private final BoundTextbookRepository bound;
    private final Textbooks textbooks;
    private final Clock clock;

    TextbookBindings(BoundTextbookRepository bound, Textbooks textbooks, Clock clock) {
        this.bound = bound;
        this.textbooks = textbooks;
        this.clock = clock;
    }

    /**
     * @param pages the teacher's pages; blank — the whole textbook
     */
    void bind(UUID assignmentId, UUID textbookId, @Nullable String pages) {
        TextbookSummary textbook = textbooks.find(textbookId).orElseThrow(TextbookBindings::notFound);
        String normalized = pages == null || pages.isBlank() ? null
                : PageRanges.parse(pages).within(textbook.pageCount()).text();
        bound.save(new BoundTextbook(assignmentId, textbookId, normalized, clock.instant()));
    }

    void unbind(UUID assignmentId, UUID textbookId) {
        if (!bound.delete(assignmentId, textbookId)) {
            throw notFound();
        }
    }

    /** The assignment's textbooks that still exist, in the order they were bound. */
    List<BoundTextbookView> of(UUID assignmentId) {
        List<BoundTextbook> found = bound.findByAssignment(assignmentId);
        if (found.isEmpty()) {
            return List.of();
        }
        Map<UUID, TextbookSummary> summaries = textbooks.find(found.stream().map(BoundTextbook::textbookId).toList())
                .stream()
                .collect(Collectors.toMap(TextbookSummary::id, Function.identity()));
        return found.stream()
                .filter(textbook -> summaries.containsKey(textbook.textbookId()))
                .map(textbook -> BoundTextbookView.of(summaries.get(textbook.textbookId()), textbook.pages()))
                .toList();
    }

    /** The bound pages of a PDF, any other file (or a textbook bound whole) whole. */
    TextbookContent content(UUID assignmentId, UUID textbookId) {
        BoundTextbook textbook = bound.find(assignmentId, textbookId).orElseThrow(TextbookBindings::notFound);
        return textbook.pages() == null
                ? textbooks.file(textbookId)
                : textbooks.content(textbookId, PageRanges.parse(textbook.pages()));
    }

    private static NotFoundException notFound() {
        return new NotFoundException("homework.textbook-not-found", "Textbook not found");
    }
}

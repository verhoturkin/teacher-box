package ru.teacherbox.textbooks.application;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.textbooks.api.PageRanges;
import ru.teacherbox.textbooks.api.TextbookContent;
import ru.teacherbox.textbooks.api.TextbookSummary;
import ru.teacherbox.textbooks.api.Textbooks;
import ru.teacherbox.textbooks.domain.Textbook;

/** Textbooks for other modules: read only, access is checked by the caller (ADR-0033). */
@Service
class TextbooksFacade implements Textbooks {

    private final TextbookService textbooks;

    TextbooksFacade(TextbookService textbooks) {
        this.textbooks = textbooks;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<TextbookSummary> find(UUID textbookId) {
        return textbooks.findOptional(textbookId).map(TextbooksFacade::summary);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TextbookSummary> find(Collection<UUID> textbookIds) {
        return textbooks.findAll(textbookIds).stream().map(TextbooksFacade::summary).toList();
    }

    @Override
    public TextbookContent content(UUID textbookId, PageRanges pages) {
        return textbooks.content(textbookId, pages);
    }

    private static TextbookSummary summary(Textbook textbook) {
        return new TextbookSummary(textbook.id(), textbook.kind(), textbook.title(), textbook.course(),
                textbook.file().format(), textbook.pageCount());
    }
}

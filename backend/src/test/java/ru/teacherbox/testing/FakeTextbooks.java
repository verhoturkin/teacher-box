package ru.teacherbox.testing;

import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.ByteArrayResource;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.textbooks.api.PageRanges;
import ru.teacherbox.textbooks.api.TextbookContent;
import ru.teacherbox.textbooks.api.TextbookFormat;
import ru.teacherbox.textbooks.api.TextbookKind;
import ru.teacherbox.textbooks.api.TextbookSummary;
import ru.teacherbox.textbooks.api.Textbooks;

/**
 * In-memory {@link Textbooks} for module tests: a file's content is its title, a cut PDF is
 * {@code "<title> pages <pages>"}.
 */
public class FakeTextbooks implements Textbooks {

    private final Map<UUID, TextbookSummary> textbooks = new ConcurrentHashMap<>();

    public UUID add(String title, TextbookFormat format, @Nullable Integer pageCount) {
        UUID id = UUID.randomUUID();
        textbooks.put(id, new TextbookSummary(id, TextbookKind.TEXTBOOK, title, "Курс", format, pageCount));
        return id;
    }

    public void remove(UUID id) {
        textbooks.remove(id);
    }

    @Override
    public Optional<TextbookSummary> find(UUID textbookId) {
        return Optional.ofNullable(textbooks.get(textbookId));
    }

    @Override
    public List<TextbookSummary> find(Collection<UUID> textbookIds) {
        return textbookIds.stream().map(textbooks::get).filter(java.util.Objects::nonNull).toList();
    }

    @Override
    public TextbookContent content(UUID textbookId, PageRanges pages) {
        TextbookSummary textbook = require(textbookId);
        if (textbook.format() != TextbookFormat.PDF) {
            return file(textbookId);
        }
        return content(textbook.title() + " (с. " + pages.text() + ").pdf", textbook.title() + " pages " + pages);
    }

    @Override
    public TextbookContent file(UUID textbookId) {
        TextbookSummary textbook = require(textbookId);
        return content(textbook.title() + ".pdf", textbook.title());
    }

    private TextbookSummary require(UUID textbookId) {
        TextbookSummary textbook = textbooks.get(textbookId);
        if (textbook == null) {
            throw new NotFoundException("textbooks.textbook-not-found", "Textbook not found");
        }
        return textbook;
    }

    private static TextbookContent content(String filename, String text) {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        return new TextbookContent(filename, "application/pdf", bytes.length, new ByteArrayResource(bytes));
    }
}

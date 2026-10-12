package ru.teacherbox.ai.application;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import ru.teacherbox.homework.api.AssignmentFiles;
import ru.teacherbox.homework.api.AssignmentFiles.AssignmentFile;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.textbooks.api.PageRanges;
import ru.teacherbox.textbooks.api.TextbookContent;
import ru.teacherbox.textbooks.api.TextbookSummary;
import ru.teacherbox.textbooks.api.Textbooks;

/**
 * The sources of a homework draft (ADR-0039): pages of a textbook or a file of an assignment, read through their
 * modules' facades and kept within what a request may carry.
 */
@Component
public class DraftSources {

    public static final int MAX_SOURCES = 5;
    public static final int MAX_PAGES = 20;
    public static final long MAX_BYTES = 20L * 1024 * 1024;
    static final Set<String> TYPES = Set.of(LlmSource.PDF, "image/png", "image/jpeg", "image/webp", "image/gif");

    /** What the teacher pointed at. */
    public sealed interface Source {
    }

    /** @param pages {@code 1-3, 7}; blank — the whole textbook if it is short enough */
    public record TextbookPages(UUID textbookId, @Nullable String pages) implements Source {
    }

    public record AssignmentFileRef(UUID assignmentId, UUID attachmentId) implements Source {
    }

    private final Textbooks textbooks;
    private final AssignmentFiles files;

    public DraftSources(Textbooks textbooks, AssignmentFiles files) {
        this.textbooks = textbooks;
        this.files = files;
    }

    /**
     * @throws BusinessRuleException {@code ai.source-unsupported} (a Word file, an unknown type),
     *                               {@code ai.source-too-large} (over 20 pages or 20 MB in all)
     * @throws NotFoundException     {@code ai.source-not-found} if a textbook or a file is gone
     */
    public List<LlmSource> read(List<Source> sources) {
        if (sources.size() > MAX_SOURCES) {
            throw tooLarge();
        }
        List<LlmSource> read = new ArrayList<>();
        long total = 0;
        for (Source source : sources) {
            LlmSource material = switch (source) {
                case TextbookPages pages -> textbook(pages);
                case AssignmentFileRef file -> file(file);
            };
            total += material.content().length;
            if (total > MAX_BYTES) {
                throw tooLarge();
            }
            read.add(material);
        }
        return read;
    }

    private LlmSource textbook(TextbookPages source) {
        TextbookSummary summary = textbooks.find(source.textbookId()).orElseThrow(DraftSources::notFound);
        return switch (summary.format()) {
            case DOCUMENT -> throw unsupported();
            case IMAGE -> material(summary.title(), textbooks.file(summary.id()));
            case PDF -> {
                PageRanges pages = pages(source.pages(), summary);
                boolean whole = source.pages() == null || source.pages().isBlank();
                yield material(whole ? summary.title() : summary.title() + ", с. " + pages.text(),
                        textbooks.content(summary.id(), pages));
            }
        };
    }

    /** The chosen pages, or the whole textbook when it is short enough. */
    private static PageRanges pages(@Nullable String pages, TextbookSummary summary) {
        Integer count = summary.pageCount();
        PageRanges ranges = pages == null || pages.isBlank()
                ? PageRanges.all(count == null ? 1 : count)
                : PageRanges.parse(pages).within(count);
        if (ranges.pages().size() > MAX_PAGES) {
            throw tooLarge();
        }
        return ranges;
    }

    private LlmSource file(AssignmentFileRef source) {
        AssignmentFile file;
        try {
            file = files.file(source.assignmentId(), source.attachmentId());
        } catch (NotFoundException e) {
            throw notFound();
        }
        return material(file.filename(), file.contentType(), file.size(), file.content());
    }

    private static LlmSource material(String name, TextbookContent content) {
        return material(name, content.contentType(), content.size(), content.content());
    }

    private static LlmSource material(String name, String contentType, long size, Resource content) {
        String type = contentType.toLowerCase(Locale.ROOT).split(";")[0].strip();
        if (!TYPES.contains(type)) {
            throw unsupported();
        }
        if (size > MAX_BYTES) {
            throw tooLarge();
        }
        try {
            return new LlmSource(name, type, content.getContentAsByteArray());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static BusinessRuleException unsupported() {
        return new BusinessRuleException("ai.source-unsupported", "The AI reads PDF files and pictures only");
    }

    private static BusinessRuleException tooLarge() {
        return new BusinessRuleException("ai.source-too-large",
                "At most " + MAX_SOURCES + " sources, " + MAX_PAGES + " pages and 20 MB at once");
    }

    private static NotFoundException notFound() {
        return new NotFoundException("ai.source-not-found", "The source of the draft is not found");
    }
}

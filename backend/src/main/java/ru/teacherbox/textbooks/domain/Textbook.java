package ru.teacherbox.textbooks.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.textbooks.api.TextbookFormat;
import ru.teacherbox.textbooks.api.TextbookKind;

/**
 * A textbook (ADR-0033): a kind, a title, a course and one file. Its members are kept apart
 * ({@link TextbookMember}).
 *
 * @param pageCount pages of the file: counted for a PDF, 1 for an image, the teacher's number (or none) for a
 *                  document
 */
public record Textbook(UUID id, TextbookKind kind, String title, @Nullable String course,
        @Nullable Integer pageCount, TextbookFile file, Instant createdAt, Instant updatedAt, long version) {

    public static final int MAX_TITLE = 200;
    public static final int MAX_COURSE = 100;
    public static final int MAX_PAGE_COUNT = 10_000;

    public Textbook {
        Objects.requireNonNull(id);
        Objects.requireNonNull(kind);
        Objects.requireNonNull(file);
        title = validTitle(title);
        course = validCourse(course);
        pageCount = validPageCount(pageCount);
    }

    /**
     * @param pageCount the teacher's number of pages, used only for a document
     * @param filePages the pages counted in a PDF
     */
    public static Textbook created(UUID id, TextbookKind kind, String title, @Nullable String course,
            @Nullable Integer pageCount, TextbookFile file, int filePages, Instant now) {
        return new Textbook(id, kind, title, course, pages(file.format(), pageCount, filePages), file, now, now, 0);
    }

    /** The file stays; the teacher's number of pages counts only for a document. */
    public Textbook changed(TextbookKind newKind, String newTitle, @Nullable String newCourse,
            @Nullable Integer newPageCount, Instant now) {
        return new Textbook(id, newKind, newTitle, newCourse,
                file.format() == TextbookFormat.DOCUMENT ? newPageCount : pageCount, file, createdAt, now, version);
    }

    /** A new file; a document keeps the teacher's number of pages only when it replaces a document. */
    public Textbook withFile(TextbookFile newFile, int filePages, Instant now) {
        Integer kept = file.format() == TextbookFormat.DOCUMENT ? pageCount : null;
        return new Textbook(id, kind, title, course, pages(newFile.format(), kept, filePages), newFile, createdAt,
                now, version);
    }

    /** Pages can be cut out and shown as pictures. */
    public boolean paged() {
        return file.format().paged();
    }

    private static @Nullable Integer pages(TextbookFormat format, @Nullable Integer teachers, int filePages) {
        return switch (format) {
            case PDF -> filePages;
            case IMAGE -> 1;
            case DOCUMENT -> teachers;
        };
    }

    private static String validTitle(@Nullable String value) {
        String title = value == null ? "" : value.strip();
        if (title.isEmpty() || title.length() > MAX_TITLE) {
            throw new BusinessRuleException("textbooks.title-invalid",
                    "The title must be 1-" + MAX_TITLE + " characters");
        }
        return title;
    }

    private static @Nullable String validCourse(@Nullable String value) {
        String course = value == null ? "" : value.strip();
        if (course.length() > MAX_COURSE) {
            throw new BusinessRuleException("textbooks.course-invalid",
                    "The course must be at most " + MAX_COURSE + " characters");
        }
        return course.isEmpty() ? null : course;
    }

    private static @Nullable Integer validPageCount(@Nullable Integer value) {
        if (value != null && (value < 1 || value > MAX_PAGE_COUNT)) {
            throw new BusinessRuleException("textbooks.page-count-invalid",
                    "The number of pages must be 1-" + MAX_PAGE_COUNT);
        }
        return value;
    }
}

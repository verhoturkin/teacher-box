package ru.teacherbox.textbooks.api;

import java.util.ArrayList;
import java.util.List;
import java.util.SortedSet;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * Pages of a textbook as the teacher writes them: {@code 1-3, 7}. Kept as the normalized text; {@link #pages()}
 * are the distinct page numbers in order.
 */
public final class PageRanges {

    /** Longest text of pages. */
    public static final int MAX_TEXT = 200;
    /** Most pages in one selection. */
    public static final int MAX_PAGES = 500;
    /** Highest page number. */
    public static final int MAX_PAGE = 10_000;

    private static final Pattern DASH = Pattern.compile("\\s*[-–—]\\s*");
    private static final Pattern SEPARATOR = Pattern.compile("[,;\\s]+");
    private static final Pattern PART = Pattern.compile("(\\d{1,5})(?:-(\\d{1,5}))?");

    private final String text;
    private final List<Integer> pages;

    private PageRanges(String text, List<Integer> pages) {
        this.text = text;
        this.pages = pages;
    }

    /**
     * @param value pages separated by commas or spaces, ranges with a hyphen or a dash
     * @throws BusinessRuleException {@code textbooks.pages-invalid} if it is empty or not pages
     */
    public static PageRanges parse(@Nullable String value) {
        String source = value == null ? "" : value.strip();
        if (source.isEmpty() || source.length() > MAX_TEXT) {
            throw invalid();
        }
        SortedSet<Integer> pages = new TreeSet<>();
        for (String part : SEPARATOR.split(DASH.matcher(source).replaceAll("-"))) {
            if (part.isEmpty()) {
                continue;
            }
            Matcher matcher = PART.matcher(part);
            if (!matcher.matches()) {
                throw invalid();
            }
            int from = Integer.parseInt(matcher.group(1));
            int to = matcher.group(2) == null ? from : Integer.parseInt(matcher.group(2));
            if (from < 1 || to < from || to > MAX_PAGE || to - from >= MAX_PAGES) {
                throw invalid();
            }
            for (int page = from; page <= to; page++) {
                pages.add(page);
            }
            if (pages.size() > MAX_PAGES) {
                throw invalid();
            }
        }
        if (pages.isEmpty()) {
            throw invalid();
        }
        return new PageRanges(text(pages), List.copyOf(pages));
    }

    /** Every page of a file with the given number of pages. */
    public static PageRanges all(int pageCount) {
        return parse(pageCount <= 1 ? "1" : "1-" + Math.min(pageCount, MAX_PAGES));
    }

    /**
     * @throws BusinessRuleException {@code textbooks.pages-beyond} if a page is past the end of the textbook
     */
    public PageRanges within(@Nullable Integer pageCount) {
        if (pageCount != null && pages.getLast() > pageCount) {
            throw new BusinessRuleException("textbooks.pages-beyond",
                    "The textbook has " + pageCount + " pages");
        }
        return this;
    }

    /** The normalized text: {@code 1-3, 7}. */
    public String text() {
        return text;
    }

    public List<Integer> pages() {
        return pages;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof PageRanges ranges && ranges.text.equals(text);
    }

    @Override
    public int hashCode() {
        return text.hashCode();
    }

    @Override
    public String toString() {
        return text;
    }

    private static String text(SortedSet<Integer> pages) {
        List<String> parts = new ArrayList<>();
        int start = -1;
        int previous = -1;
        for (int page : pages) {
            if (page != previous + 1) {
                if (start > 0) {
                    parts.add(part(start, previous));
                }
                start = page;
            }
            previous = page;
        }
        parts.add(part(start, previous));
        return String.join(", ", parts);
    }

    private static String part(int from, int to) {
        return from == to ? String.valueOf(from) : from + "-" + to;
    }

    private static BusinessRuleException invalid() {
        return new BusinessRuleException("textbooks.pages-invalid", "Pages like 1-3, 7");
    }
}

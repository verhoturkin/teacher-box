package ru.teacherbox.textbooks.domain;

import java.util.Objects;
import ru.teacherbox.textbooks.api.TextbookFormat;

/**
 * The file of a textbook in the {@code textbooks} namespace of the file storage.
 *
 * @param contentType the type found by {@link TextbookFiles}, served on download
 */
public record TextbookFile(String key, String filename, String contentType, long size, TextbookFormat format) {

    public TextbookFile {
        Objects.requireNonNull(key);
        Objects.requireNonNull(filename);
        Objects.requireNonNull(contentType);
        Objects.requireNonNull(format);
    }
}

package ru.teacherbox.textbooks.api;

/** The file of a textbook: its pages can be cut out and rendered only for a PDF; an image is one page. */
public enum TextbookFormat {
    IMAGE,
    PDF,
    DOCUMENT;

    /** Pages of the file can be cut out and shown as pictures. */
    public boolean paged() {
        return this != DOCUMENT;
    }
}

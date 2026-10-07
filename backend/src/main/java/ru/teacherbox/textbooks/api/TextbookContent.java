package ru.teacherbox.textbooks.api;

import org.springframework.core.io.Resource;

/**
 * A file to hand to a user: the whole file of a textbook or a PDF cut to some of its pages.
 *
 * @param filename    the name to download it under
 * @param contentType the type fixed when the file was uploaded
 */
public record TextbookContent(String filename, String contentType, long size, Resource content) {
}

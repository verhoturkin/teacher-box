package ru.teacherbox.notifications.application;

import java.util.Objects;

/**
 * A file of an incoming message, downloaded only when an action takes it (ADR-0038).
 *
 * @param name     the file's name, or a made-up one for a photo (e.g. {@code photo.jpg})
 * @param size     bytes as the messenger tells; {@code -1} if it does not
 * @param download fetches the content from the messenger
 */
public record IncomingFile(String name, long size, Download download) {

    /** Fetches the content; throws a runtime exception if the messenger does not give it. */
    @FunctionalInterface
    public interface Download {

        byte[] content();
    }

    public IncomingFile {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(download, "download");
    }
}

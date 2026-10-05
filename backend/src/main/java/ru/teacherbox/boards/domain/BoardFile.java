package ru.teacherbox.boards.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * An image of a board.
 *
 * @param fileId  Excalidraw's id of the file (the same image in two boards is two files)
 * @param fileKey the key in the {@code boards} namespace of the file storage
 */
public record BoardFile(UUID boardId, String fileId, String fileKey, String contentType, long size,
        Instant createdAt) {
}

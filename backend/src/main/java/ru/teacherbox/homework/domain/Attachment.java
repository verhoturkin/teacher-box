package ru.teacherbox.homework.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Metadata of a stored file; the content lives in the file storage under {@code fileKey}.
 *
 * @param contentType derived from the file extension on upload (the client's value is not trusted)
 */
public record Attachment(
        UUID id,
        AttachmentOwner ownerType,
        UUID ownerId,
        String fileKey,
        String filename,
        String contentType,
        long size,
        String sha256,
        Instant uploadedAt) {
}

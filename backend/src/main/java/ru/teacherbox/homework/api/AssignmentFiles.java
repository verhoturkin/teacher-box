package ru.teacherbox.homework.api;

import java.util.UUID;
import org.springframework.core.io.Resource;

/** Read-only access to the files of assignments for other modules (ADR-0039); access is checked by the caller. */
public interface AssignmentFiles {

    /**
     * A file of the assignment's materials.
     *
     * @throws ru.teacherbox.shared.error.NotFoundException if the assignment has no such file
     */
    AssignmentFile file(UUID assignmentId, UUID attachmentId);

    /**
     * @param contentType the type found when the file was uploaded
     */
    record AssignmentFile(String filename, String contentType, long size, Resource content) {
    }
}

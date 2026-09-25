package ru.teacherbox.shared.files;

import java.io.InputStream;
import org.springframework.core.io.Resource;

/**
 * Binary file storage. Every module works only inside its own {@code namespace} (usually the module name).
 * File metadata (original name, content type, owner) is stored by the module itself.
 */
public interface FileStorage {

    /** Stores the content under a newly generated key. The stream is fully consumed but not closed. */
    StoredFile store(String namespace, InputStream content);

    /** @throws ru.teacherbox.shared.error.NotFoundException if the file does not exist */
    Resource load(String namespace, String key);

    /** Deletes the file; does nothing if it does not exist. */
    void delete(String namespace, String key);
}

package ru.teacherbox.platform.backup.drive;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.function.UnaryOperator;
import tools.jackson.databind.json.JsonMapper;

/**
 * The connection in {@code <data-dir>/google-drive.json}: it belongs to the server like the backups
 * themselves and survives a restore and a full reset (ADR-0037).
 */
public class DriveConnectionStore {

    private final Path file;
    private final JsonMapper json;

    public DriveConnectionStore(Path file, JsonMapper json) {
        this.file = file;
        this.json = json;
    }

    public synchronized DriveConnection load() {
        if (!Files.isRegularFile(file)) {
            return DriveConnection.none();
        }
        try {
            return json.readValue(Files.readString(file), DriveConnection.class);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Changes the stored connection and returns the new one. */
    public synchronized DriveConnection update(UnaryOperator<DriveConnection> change) {
        DriveConnection changed = change.apply(load());
        try {
            Files.createDirectories(file.toAbsolutePath().getParent());
            Path partial = file.resolveSibling(file.getFileName() + ".part");
            Files.writeString(partial, json.writeValueAsString(changed));
            Files.move(partial, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return changed;
    }
}

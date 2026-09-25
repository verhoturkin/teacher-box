package ru.teacherbox.platform.backup;

import java.nio.file.Path;
import java.util.regex.Pattern;

/**
 * Layout of a backup archive (a zip file):
 * <pre>
 * manifest.properties   format version and creation time
 * database.sql          logical dump of the whole H2 database (H2 {@code SCRIPT})
 * files/...             copy of {@code <data-dir>/files}
 * </pre>
 * A logical dump survives H2 upgrades, unlike a binary copy of the database file.
 */
final class BackupArchive {

    static final String MANIFEST = "manifest.properties";
    static final String DATABASE = "database.sql";
    static final String FILES = "files/";
    static final int FORMAT = 1;
    static final Pattern NAME = Pattern.compile("teacherbox-\\d{8}-\\d{6}-\\d{3}\\.zip");

    private BackupArchive() {
    }

    static boolean isValidName(String name) {
        return NAME.matcher(name).matches();
    }

    /**
     * Resolves a zip entry below {@code target}, rejecting entries that would escape it (zip slip).
     */
    static Path safeResolve(Path target, String entryName) {
        Path resolved = target.resolve(entryName).normalize();
        if (!resolved.startsWith(target.normalize())) {
            throw new IllegalStateException("Illegal entry in backup archive: " + entryName);
        }
        return resolved;
    }
}

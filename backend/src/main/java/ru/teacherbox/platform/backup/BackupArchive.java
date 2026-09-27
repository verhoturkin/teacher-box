package ru.teacherbox.platform.backup;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Path;
import java.util.Optional;
import java.util.Properties;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Layout of a backup archive (a zip file):
 * <pre>
 * manifest.properties   format version, creation time, kind and version of the portal
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

    /** Keys of the manifest. */
    static final String FORMAT_KEY = "format";
    static final String CREATED_AT_KEY = "createdAt";
    static final String KIND_KEY = "kind";
    static final String VERSION_KEY = "version";

    private BackupArchive() {
    }

    static boolean isValidName(String name) {
        return NAME.matcher(name).matches();
    }

    /** The manifest of an archive; empty for a file that is not a readable archive. */
    static Optional<Properties> manifest(Path archive) {
        try (ZipFile zip = new ZipFile(archive.toFile())) {
            ZipEntry entry = zip.getEntry(MANIFEST);
            if (entry == null) {
                return Optional.of(new Properties());
            }
            Properties manifest = new Properties();
            try (InputStream in = zip.getInputStream(entry)) {
                manifest.load(in);
            }
            return Optional.of(manifest);
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    /** Whether the archive has a database dump. */
    static boolean hasDatabase(Path archive) {
        try (ZipFile zip = new ZipFile(archive.toFile())) {
            return zip.getEntry(DATABASE) != null;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
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

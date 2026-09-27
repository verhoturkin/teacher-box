package ru.teacherbox.platform.backup;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Clock;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Properties;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Creates, lists and rotates backups in {@code <data-dir>/backups}. */
public class BackupService {

    private static final Logger log = LoggerFactory.getLogger(BackupService.class);
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS");

    /**
     * A backup file.
     *
     * @param kind    why it was made; {@code null} for backups made before version 1.3
     * @param version version of the portal that made it; {@code null} if unknown
     */
    public record BackupInfo(String name, long size, Instant createdAt, @Nullable BackupKind kind,
            @Nullable String version) {
    }

    private final JdbcClient jdbc;
    private final Path dataDir;
    private final Path backupDir;
    private final BackupProperties properties;
    private final InstanceTimeZone timeZone;
    private final @Nullable String appVersion;
    private final Clock clock;

    public BackupService(JdbcClient jdbc, Path dataDir, BackupProperties properties, InstanceTimeZone timeZone,
            @Nullable String appVersion, Clock clock) {
        this.jdbc = jdbc;
        this.dataDir = dataDir;
        this.backupDir = dataDir.resolve("backups");
        this.properties = properties;
        this.timeZone = timeZone;
        this.appVersion = appVersion;
        this.clock = clock;
    }

    /** A backup by the teacher or the administrator. */
    public BackupInfo create() {
        return create(BackupKind.MANUAL);
    }

    /**
     * Writes a new backup and deletes the oldest scheduled and manual ones beyond
     * {@link BackupProperties#keep()}.
     */
    public synchronized BackupInfo create(BackupKind kind) {
        Instant now = clock.instant();
        try {
            Files.createDirectories(backupDir);
            Path target = uniqueTarget(now);
            Path partial = backupDir.resolve(target.getFileName() + ".part");
            try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(partial))) {
                writeManifest(zip, now, kind);
                writeDatabase(zip);
                writeFiles(zip);
            } catch (IOException | RuntimeException e) {
                Files.deleteIfExists(partial);
                throw e;
            }
            Files.move(partial, target, StandardCopyOption.ATOMIC_MOVE);
            BackupInfo info = info(target);
            log.info("Backup {} created ({}, {} bytes)", info.name(), kind, info.size());
            rotate();
            return info;
        } catch (IOException e) {
            throw new UncheckedIOException("Backup failed", e);
        }
    }

    /** Newest first. */
    public List<BackupInfo> list() {
        if (!Files.isDirectory(backupDir)) {
            return List.of();
        }
        try (Stream<Path> files = Files.list(backupDir)) {
            return files.filter(file -> BackupArchive.isValidName(file.getFileName().toString()))
                    .map(BackupService::info)
                    .sorted(Comparator.comparing(BackupInfo::name).reversed())
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public Path file(String name) {
        return find(name).orElseThrow(() -> new NotFoundException("backup.not-found", "Backup not found"));
    }

    public BackupInfo info(String name) {
        return info(file(name));
    }

    public void delete(String name) {
        try {
            Files.delete(file(name));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Version of the running portal; {@code null} in development. */
    public @Nullable String appVersion() {
        return appVersion;
    }

    private Optional<Path> find(String name) {
        if (!BackupArchive.isValidName(name)) {
            return Optional.empty();
        }
        Path file = backupDir.resolve(name);
        return Files.isRegularFile(file) ? Optional.of(file) : Optional.empty();
    }

    /** Fixed-width names sort chronologically; a name taken in the same millisecond moves on. */
    private Path uniqueTarget(Instant now) {
        Instant stamp = now;
        Path target = target(stamp);
        while (Files.exists(target)) {
            stamp = stamp.plusMillis(1);
            target = target(stamp);
        }
        return target;
    }

    private Path target(Instant stamp) {
        return backupDir.resolve("teacherbox-" + STAMP.format(stamp.atZone(timeZone.zoneId())) + ".zip");
    }

    private void writeManifest(ZipOutputStream zip, Instant now, BackupKind kind) throws IOException {
        zip.putNextEntry(new ZipEntry(BackupArchive.MANIFEST));
        StringBuilder manifest = new StringBuilder()
                .append(BackupArchive.FORMAT_KEY).append('=').append(BackupArchive.FORMAT).append('\n')
                .append(BackupArchive.CREATED_AT_KEY).append('=').append(now).append('\n')
                .append(BackupArchive.KIND_KEY).append('=').append(kind.name()).append('\n');
        if (appVersion != null) {
            manifest.append(BackupArchive.VERSION_KEY).append('=').append(appVersion).append('\n');
        }
        zip.write(manifest.toString().getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    /** Streams the H2 {@code SCRIPT} result (one SQL statement per row) into the archive. */
    private void writeDatabase(ZipOutputStream zip) throws IOException {
        zip.putNextEntry(new ZipEntry(BackupArchive.DATABASE));
        // Not closed on purpose: that would close the zip stream; flushed before the entry ends.
        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(zip, StandardCharsets.UTF_8));
        jdbc.sql("SCRIPT").query((java.sql.ResultSet rs) -> {
            try {
                writer.write(rs.getString(1));
                writer.newLine();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });
        writer.flush();
        zip.closeEntry();
    }

    private void writeFiles(ZipOutputStream zip) throws IOException {
        Path files = dataDir.resolve("files");
        if (!Files.isDirectory(files)) {
            return;
        }
        List<Path> regularFiles;
        try (Stream<Path> tree = Files.walk(files)) {
            regularFiles = tree.filter(Files::isRegularFile).sorted().toList();
        }
        for (Path file : regularFiles) {
            String relative = files.relativize(file).toString().replace('\\', '/');
            zip.putNextEntry(new ZipEntry(BackupArchive.FILES + relative));
            Files.copy(file, zip);
            zip.closeEntry();
        }
    }

    /** Only scheduled and manual backups are rotated (and those made before kinds existed). */
    private void rotate() throws IOException {
        List<BackupInfo> rotated = list().stream()
                .filter(backup -> backup.kind() == null || backup.kind().isRotated())
                .toList();
        for (BackupInfo old : rotated.subList(Math.min(properties.keep(), rotated.size()), rotated.size())) {
            Files.deleteIfExists(backupDir.resolve(old.name()));
            log.info("Old backup {} deleted", old.name());
        }
    }

    private static BackupInfo info(Path file) {
        try {
            Properties manifest = BackupArchive.manifest(file).orElseGet(Properties::new);
            return new BackupInfo(file.getFileName().toString(), Files.size(file),
                    Files.getLastModifiedTime(file).toInstant(), kind(manifest.getProperty(BackupArchive.KIND_KEY)),
                    manifest.getProperty(BackupArchive.VERSION_KEY));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static @Nullable BackupKind kind(@Nullable String value) {
        if (value == null) {
            return null;
        }
        try {
            return BackupKind.valueOf(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}

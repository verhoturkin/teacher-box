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
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Creates, lists and rotates backups in {@code <data-dir>/backups}. */
public class BackupService {

    private static final Logger log = LoggerFactory.getLogger(BackupService.class);
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS");

    /** A backup file. */
    public record BackupInfo(String name, long size, Instant createdAt) {
    }

    private final JdbcClient jdbc;
    private final Path dataDir;
    private final Path backupDir;
    private final BackupProperties properties;
    private final InstanceTimeZone timeZone;
    private final Clock clock;

    public BackupService(JdbcClient jdbc, Path dataDir, BackupProperties properties, InstanceTimeZone timeZone,
            Clock clock) {
        this.jdbc = jdbc;
        this.dataDir = dataDir;
        this.backupDir = dataDir.resolve("backups");
        this.properties = properties;
        this.timeZone = timeZone;
        this.clock = clock;
    }

    /** Writes a new backup and deletes the oldest ones beyond {@link BackupProperties#keep()}. */
    public synchronized BackupInfo create() {
        Instant now = clock.instant();
        try {
            Files.createDirectories(backupDir);
            Path target = uniqueTarget(now);
            Path partial = backupDir.resolve(target.getFileName() + ".part");
            try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(partial))) {
                writeManifest(zip, now);
                writeDatabase(zip);
                writeFiles(zip);
            } catch (IOException | RuntimeException e) {
                Files.deleteIfExists(partial);
                throw e;
            }
            Files.move(partial, target, StandardCopyOption.ATOMIC_MOVE);
            BackupInfo info = info(target);
            log.info("Backup {} created ({} bytes)", info.name(), info.size());
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

    public void delete(String name) {
        try {
            Files.delete(file(name));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
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

    private void writeManifest(ZipOutputStream zip, Instant now) throws IOException {
        zip.putNextEntry(new ZipEntry(BackupArchive.MANIFEST));
        zip.write(("format=" + BackupArchive.FORMAT + "\ncreatedAt=" + now + "\n").getBytes(StandardCharsets.UTF_8));
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

    private void rotate() throws IOException {
        List<BackupInfo> backups = list();
        for (BackupInfo old : backups.subList(Math.min(properties.keep(), backups.size()), backups.size())) {
            Files.deleteIfExists(backupDir.resolve(old.name()));
            log.info("Old backup {} deleted", old.name());
        }
    }

    private static BackupInfo info(Path file) {
        try {
            return new BackupInfo(file.getFileName().toString(), Files.size(file),
                    Files.getLastModifiedTime(file).toInstant());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}

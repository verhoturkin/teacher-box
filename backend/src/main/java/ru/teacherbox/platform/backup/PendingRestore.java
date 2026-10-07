package ru.teacherbox.platform.backup;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Properties;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;

/**
 * Restores a backup on startup, before the database is opened: put the archive into
 * {@code <data-dir>/restore/} (or ask for it in the interface) and restart. The current database
 * and files are moved to {@code restore/previous-<time>/}, the archive to {@code restore/applied/}.
 * If restoring fails, the previous state is put back, the archive goes to {@code restore/failed/}
 * and the application starts as before. The outcome is kept in {@value #RESULT} for the interface.
 */
public class PendingRestore implements ApplicationListener<ApplicationEnvironmentPreparedEvent>, Ordered {

    /** The outcome of the latest restore, next to the archives. */
    static final String RESULT = "last-result.properties";

    private static final Logger log = LoggerFactory.getLogger(PendingRestore.class);
    /** A database in files: {@code async:} since 0.10.0, {@code file:} before (and in a custom setting). */
    private static final List<String> FILE_DATABASES = List.of("jdbc:h2:async:", "jdbc:h2:file:");

    @Override
    public int getOrder() {
        // After the logging system is initialized (LoggingApplicationListener).
        return Ordered.HIGHEST_PRECEDENCE + 100;
    }

    @Override
    public void onApplicationEvent(ApplicationEnvironmentPreparedEvent event) {
        ConfigurableEnvironment environment = event.getEnvironment();
        String url = environment.getProperty("spring.datasource.url", "");
        if (FILE_DATABASES.stream().noneMatch(url::startsWith)) {
            return;
        }
        Path dataDir = Path.of(environment.getProperty("teacherbox.data-dir", "./data"));
        String user = environment.getProperty("spring.datasource.username", "sa");
        String password = environment.getProperty("spring.datasource.password", "");
        restore(dataDir, url, user, password, Instant.now());
    }

    /** @return the restored archive, if there was one and it was restored */
    static Optional<Path> restore(Path dataDir, String url, String user, String password, Instant now) {
        Path restoreDir = dataDir.resolve("restore");
        Optional<Path> archive = pendingArchive(restoreDir);
        if (archive.isEmpty()) {
            return Optional.empty();
        }
        Path file = archive.get();
        String name = file.getFileName().toString();
        log.warn("Restoring backup {}", name);
        Path previous = restoreDir.resolve("previous-" + now.toString().replace(':', '-'));
        try {
            Files.createDirectories(previous);
            moveIfExists(dataDir.resolve("db"), previous.resolve("db"));
            moveIfExists(dataDir.resolve("files"), previous.resolve("files"));
            try {
                extract(file, dataDir, url, user, password);
            } catch (IOException | SQLException | RuntimeException e) {
                rollback(dataDir, previous);
                Path failed = restoreDir.resolve("failed");
                Files.createDirectories(failed);
                Files.move(file, failed.resolve(name), StandardCopyOption.REPLACE_EXISTING);
                log.error("Restoring {} failed; the previous data is back and the archive is in {}", name, failed, e);
                writeResult(restoreDir, false, name, now, reason(e));
                return Optional.empty();
            }
            Path applied = restoreDir.resolve("applied");
            Files.createDirectories(applied);
            Files.move(file, applied.resolve(name), StandardCopyOption.REPLACE_EXISTING);
            writeResult(restoreDir, true, name, now, null);
            log.warn("Backup {} restored; the previous data is kept in {}", name, previous);
            return Optional.of(applied.resolve(name));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static Optional<Path> pendingArchive(Path restoreDir) {
        if (!Files.isDirectory(restoreDir)) {
            return Optional.empty();
        }
        try (Stream<Path> files = Files.list(restoreDir)) {
            List<Path> archives = files
                    .filter(file -> Files.isRegularFile(file) && file.getFileName().toString().endsWith(".zip"))
                    .sorted(Comparator.comparing((Path file) -> file.getFileName().toString()).reversed())
                    .toList();
            if (archives.size() > 1) {
                log.warn("Several archives in {}, restoring the newest name: {}", restoreDir, archives.getFirst());
            }
            return archives.stream().findFirst();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static void extract(Path archive, Path dataDir, String url, String user, String password)
            throws IOException, SQLException {
        Path files = dataDir.resolve("files");
        Path script = Files.createTempFile("teacherbox-restore", ".sql");
        boolean hasDatabase = false;
        try {
            try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(archive))) {
                for (ZipEntry entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                    if (entry.isDirectory()) {
                        continue;
                    }
                    if (entry.getName().equals(BackupArchive.DATABASE)) {
                        Files.copy(zip, script, StandardCopyOption.REPLACE_EXISTING);
                        hasDatabase = true;
                    } else if (entry.getName().startsWith(BackupArchive.FILES)) {
                        Path target = BackupArchive.safeResolve(files,
                                entry.getName().substring(BackupArchive.FILES.length()));
                        Files.createDirectories(target.getParent());
                        copy(zip, target);
                    }
                }
            }
            if (!hasDatabase) {
                throw new IllegalStateException("The archive has no " + BackupArchive.DATABASE);
            }
            try (Connection connection = DriverManager.getConnection(url, user, password);
                    PreparedStatement statement = connection.prepareStatement("RUNSCRIPT FROM ?")) {
                statement.setString(1, script.toAbsolutePath().toString());
                statement.execute();
            }
        } finally {
            Files.deleteIfExists(script);
        }
    }

    /** The error in a few words for the interface: the log has the rest. */
    private static String reason(Exception e) {
        String message = e.getMessage();
        String text = message == null || message.isBlank() ? e.getClass().getSimpleName() : message;
        return text.length() > 300 ? text.substring(0, 300) : text;
    }

    private static void writeResult(Path restoreDir, boolean restored, String archive, Instant at,
            @Nullable String error) throws IOException {
        Properties result = new Properties();
        result.setProperty("status", restored ? "RESTORED" : "FAILED");
        result.setProperty("archive", archive);
        result.setProperty("at", at.toString());
        if (error != null) {
            result.setProperty("error", error);
        }
        try (OutputStream out = Files.newOutputStream(restoreDir.resolve(RESULT))) {
            result.store(out, null);
        }
    }

    private static void copy(InputStream in, Path target) throws IOException {
        Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
    }

    private static void rollback(Path dataDir, Path previous) throws IOException {
        deleteTree(dataDir.resolve("db"));
        deleteTree(dataDir.resolve("files"));
        moveIfExists(previous.resolve("db"), dataDir.resolve("db"));
        moveIfExists(previous.resolve("files"), dataDir.resolve("files"));
    }

    private static void moveIfExists(Path source, Path target) throws IOException {
        if (Files.exists(source)) {
            Files.move(source, target);
        }
    }

    private static void deleteTree(@Nullable Path root) throws IOException {
        if (root == null || !Files.exists(root)) {
            return;
        }
        try (Stream<Path> tree = Files.walk(root)) {
            for (Path path : tree.sorted(Comparator.reverseOrder()).toList()) {
                Files.delete(path);
            }
        }
    }
}

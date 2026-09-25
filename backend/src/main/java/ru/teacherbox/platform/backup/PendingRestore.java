package ru.teacherbox.platform.backup;

import java.io.IOException;
import java.io.InputStream;
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
 * {@code <data-dir>/restore/} and restart. The current database and files are moved to
 * {@code restore/previous-<time>/}, the archive to {@code restore/applied/}. If restoring fails,
 * the previous state is put back and the application does not start.
 */
public class PendingRestore implements ApplicationListener<ApplicationEnvironmentPreparedEvent>, Ordered {

    private static final Logger log = LoggerFactory.getLogger(PendingRestore.class);
    private static final String FILE_DATABASE = "jdbc:h2:file:";

    @Override
    public int getOrder() {
        // After the logging system is initialized (LoggingApplicationListener).
        return Ordered.HIGHEST_PRECEDENCE + 100;
    }

    @Override
    public void onApplicationEvent(ApplicationEnvironmentPreparedEvent event) {
        ConfigurableEnvironment environment = event.getEnvironment();
        String url = environment.getProperty("spring.datasource.url", "");
        if (!url.startsWith(FILE_DATABASE)) {
            return;
        }
        Path dataDir = Path.of(environment.getProperty("teacherbox.data-dir", "./data"));
        String user = environment.getProperty("spring.datasource.username", "sa");
        String password = environment.getProperty("spring.datasource.password", "");
        restore(dataDir, url, user, password, Instant.now());
    }

    /** @return the restored archive, if there was one */
    static Optional<Path> restore(Path dataDir, String url, String user, String password, Instant now) {
        Path restoreDir = dataDir.resolve("restore");
        Optional<Path> archive = pendingArchive(restoreDir);
        if (archive.isEmpty()) {
            return Optional.empty();
        }
        log.warn("Restoring backup {}", archive.get().getFileName());
        Path previous = restoreDir.resolve("previous-" + now.toString().replace(':', '-'));
        try {
            Files.createDirectories(previous);
            moveIfExists(dataDir.resolve("db"), previous.resolve("db"));
            moveIfExists(dataDir.resolve("files"), previous.resolve("files"));
            try {
                extract(archive.get(), dataDir, url, user, password);
            } catch (IOException | SQLException | RuntimeException e) {
                rollback(dataDir, previous);
                throw new IllegalStateException("Restoring " + archive.get().getFileName() + " failed", e);
            }
            Path applied = restoreDir.resolve("applied");
            Files.createDirectories(applied);
            Files.move(archive.get(), applied.resolve(archive.get().getFileName()), StandardCopyOption.REPLACE_EXISTING);
            log.warn("Backup {} restored; the previous data is kept in {}", archive.get().getFileName(), previous);
            return Optional.of(applied.resolve(archive.get().getFileName()));
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

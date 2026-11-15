package ru.teacherbox.platform.backup;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;

/**
 * After a successful start deletes what {@link PendingRestore} left in {@code restore/} longer ago than
 * {@link BackupProperties#keepDays()}: the {@code previous-*} copies of the data and the archives in
 * {@code applied/}. The archives in {@code failed/} stay for the administrator to look at.
 */
public class RestoreLeftovers implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger(RestoreLeftovers.class);

    private final Path restoreDir;
    /** Read on every start: the administrator changes the days kept without a restart (ADR-0056). */
    private final Supplier<BackupProperties> properties;
    private final Clock clock;

    public RestoreLeftovers(Path dataDir, Supplier<BackupProperties> properties, Clock clock) {
        this.restoreDir = dataDir.resolve("restore");
        this.properties = properties;
        this.clock = clock;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        try {
            deleteExpired();
        } catch (IOException | UncheckedIOException e) {
            // the portal works without the cleanup; the next start tries again
            log.warn("Old restore leftovers in {} not deleted", restoreDir, e);
        }
    }

    /** @return how many copies and archives were deleted */
    int deleteExpired() throws IOException {
        Instant oldest = clock.instant().minus(properties.get().retention());
        int deleted = 0;
        for (Path previous : children(restoreDir)) {
            if (Files.isDirectory(previous) && previous.getFileName().toString().startsWith("previous-")
                    && olderThan(previous, oldest)) {
                deleteTree(previous);
                log.info("Old data before a restore deleted: {}", previous.getFileName());
                deleted++;
            }
        }
        for (Path archive : children(restoreDir.resolve("applied"))) {
            if (Files.isRegularFile(archive) && olderThan(archive, oldest)) {
                Files.delete(archive);
                log.info("Old restored archive deleted: {}", archive.getFileName());
                deleted++;
            }
        }
        return deleted;
    }

    private static List<Path> children(Path dir) throws IOException {
        if (!Files.isDirectory(dir)) {
            return List.of();
        }
        try (Stream<Path> files = Files.list(dir)) {
            return files.toList();
        }
    }

    /** {@code previous-*} is made at the restore, an archive in {@code applied/} is touched then. */
    private static boolean olderThan(Path path, Instant oldest) throws IOException {
        return Files.getLastModifiedTime(path).toInstant().isBefore(oldest);
    }

    private static void deleteTree(Path root) throws IOException {
        try (Stream<Path> tree = Files.walk(root)) {
            for (Path path : tree.sorted(Comparator.reverseOrder()).toList()) {
                Files.delete(path);
            }
        }
    }
}

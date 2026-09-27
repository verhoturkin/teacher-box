package ru.teacherbox.platform.backup;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Properties;
import java.util.UUID;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.ObjectProvider;
import ru.teacherbox.platform.backup.BackupService.BackupInfo;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.security.PasswordConfirmation;

/**
 * Restoring a backup from the interface (ADR-0014): the archive is checked, the current state is
 * backed up, the archive is put into {@code restore/} and the application restarts to apply it.
 */
public class RestoreService {

    /**
     * @param safetyBackup the backup of the state before restoring
     * @param restarting   the portal restarts by itself; otherwise it has to be restarted by hand
     */
    public record RestoreRequested(String archive, String safetyBackup, boolean restarting) {
    }

    /** @param restored {@code false}: the previous data stayed */
    public record LastRestore(boolean restored, String archive, Instant at, @Nullable String error) {
    }

    /**
     * @param startedAt      when the running application started: a new value means it has restarted
     * @param restartEnabled the portal restarts by itself after a restore is requested
     * @param pending        an archive waits in {@code restore/} for the next start
     */
    public record RestoreStatus(Instant startedAt, boolean restartEnabled, @Nullable String pending,
            @Nullable LastRestore lastRestore) {
    }

    private final BackupService backups;
    private final Path restoreDir;
    private final ObjectProvider<PasswordConfirmation> passwords;
    private final Restarter restarter;
    private final boolean restartEnabled;
    private final Instant startedAt;

    public RestoreService(BackupService backups, Path dataDir, ObjectProvider<PasswordConfirmation> passwords,
            Restarter restarter, boolean restartEnabled, Instant startedAt) {
        this.backups = backups;
        this.restoreDir = dataDir.resolve("restore");
        this.passwords = passwords;
        this.restarter = restarter;
        this.restartEnabled = restartEnabled;
        this.startedAt = startedAt;
    }

    /**
     * @param userId   who asks (the teacher or the administrator)
     * @param password the user's password: restoring replaces all data
     */
    public synchronized RestoreRequested request(String name, UUID userId, String password) {
        confirm(userId, password);
        Path archive = backups.file(name);
        check(archive);
        BackupInfo safety = backups.create(BackupKind.BEFORE_RESTORE);
        try {
            Files.createDirectories(restoreDir);
            for (Path waiting : pendingArchives()) {
                Files.delete(waiting);
            }
            Path partial = restoreDir.resolve(name + ".part");
            Files.copy(archive, partial, StandardCopyOption.REPLACE_EXISTING);
            Files.move(partial, restoreDir.resolve(name), StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        if (restartEnabled) {
            restarter.restartSoon();
        }
        return new RestoreRequested(name, safety.name(), restartEnabled);
    }

    public RestoreStatus status() {
        List<Path> pending = pendingArchives();
        return new RestoreStatus(startedAt, restartEnabled,
                pending.isEmpty() ? null : pending.getFirst().getFileName().toString(), lastRestore());
    }

    /** Checks the password of a dangerous action ({@code password.wrong-current} otherwise). */
    public void confirm(UUID userId, String password) {
        PasswordConfirmation confirmation = passwords.getIfAvailable();
        if (confirmation == null || !confirmation.matches(userId, password)) {
            throw new BusinessRuleException("password.wrong-current", "The password is incorrect");
        }
    }

    /** A readable archive of a known format, made by this version of the portal or an earlier one. */
    private void check(Path archive) {
        Properties manifest = BackupArchive.manifest(archive)
                .orElseThrow(() -> new BusinessRuleException("backup.damaged", "The backup cannot be read"));
        if (!BackupArchive.hasDatabase(archive)) {
            throw new BusinessRuleException("backup.damaged", "The backup has no database");
        }
        int format;
        try {
            format = Integer.parseInt(manifest.getProperty(BackupArchive.FORMAT_KEY, "1").strip());
        } catch (NumberFormatException e) {
            throw new BusinessRuleException("backup.damaged", "The backup has an unknown format");
        }
        if (format > BackupArchive.FORMAT) {
            throw new BusinessRuleException("backup.newer-version", "The backup was made by a newer portal");
        }
        String version = manifest.getProperty(BackupArchive.VERSION_KEY);
        String running = backups.appVersion();
        if (version != null && running != null && Versions.compare(version, running) > 0) {
            throw new BusinessRuleException("backup.newer-version",
                    "The backup was made by version " + version + ", the portal is " + running);
        }
    }

    private List<Path> pendingArchives() {
        if (!Files.isDirectory(restoreDir)) {
            return List.of();
        }
        try (Stream<Path> files = Files.list(restoreDir)) {
            return files.filter(file -> Files.isRegularFile(file) && file.getFileName().toString().endsWith(".zip"))
                    .sorted()
                    .toList()
                    .reversed();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private @Nullable LastRestore lastRestore() {
        Path file = restoreDir.resolve(PendingRestore.RESULT);
        if (!Files.isRegularFile(file)) {
            return null;
        }
        Properties result = new Properties();
        try (InputStream in = Files.newInputStream(file)) {
            result.load(in);
        } catch (IOException e) {
            return null;
        }
        return Optional.ofNullable(result.getProperty("at"))
                .map(at -> new LastRestore("RESTORED".equals(result.getProperty("status")),
                        result.getProperty("archive", ""), Instant.parse(at), result.getProperty("error")))
                .orElse(null);
    }

    /** Versions like {@code 1.3.0}; a suffix such as {@code -SNAPSHOT} is ignored. */
    static final class Versions {

        private Versions() {
        }

        static int compare(String left, String right) {
            int[] a = parts(left);
            int[] b = parts(right);
            for (int i = 0; i < Math.max(a.length, b.length); i++) {
                int x = i < a.length ? a[i] : 0;
                int y = i < b.length ? b[i] : 0;
                if (x != y) {
                    return Integer.compare(x, y);
                }
            }
            return 0;
        }

        private static int[] parts(String version) {
            String plain = version.strip().replaceAll("[^0-9.].*$", "");
            return Stream.of(plain.split("\\."))
                    .filter(part -> !part.isEmpty())
                    .mapToInt(Integer::parseInt)
                    .toArray();
        }
    }
}

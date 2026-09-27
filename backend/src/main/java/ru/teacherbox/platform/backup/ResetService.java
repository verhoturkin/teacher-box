package ru.teacherbox.platform.backup;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import ru.teacherbox.platform.backup.BackupService.BackupInfo;
import ru.teacherbox.shared.data.DataReset;

/**
 * The full reset of the portal (ADR-0014): the password, a backup of everything, then every module
 * deletes its data in one transaction, then the files of the modules are deleted.
 */
public class ResetService {

    /**
     * @param backup the backup with the data before the reset
     * @param hints  what the teacher should do by hand (e.g. delete a calendar in Google)
     */
    public record ResetResult(String backup, List<String> hints) {
    }

    private static final Logger log = LoggerFactory.getLogger(ResetService.class);

    private final BackupService backups;
    private final RestoreService restores;
    private final ObjectProvider<DataReset> resets;
    private final ObjectProvider<PlatformTransactionManager> transactions;
    private final JdbcClient jdbc;
    private final Path files;

    public ResetService(BackupService backups, RestoreService restores, ObjectProvider<DataReset> resets,
            ObjectProvider<PlatformTransactionManager> transactions, JdbcClient jdbc, Path dataDir) {
        this.backups = backups;
        this.restores = restores;
        this.resets = resets;
        this.transactions = transactions;
        this.jdbc = jdbc;
        this.files = dataDir.resolve("files");
    }

    /**
     * @param userId   the teacher
     * @param password the teacher's password
     */
    public synchronized ResetResult reset(UUID userId, String password) {
        restores.confirm(userId, password);
        BackupInfo backup = backups.create(BackupKind.BEFORE_RESET);
        List<DataReset> modules = resets.orderedStream().toList();
        new TransactionTemplate(transactions.getObject()).executeWithoutResult(status -> {
            modules.forEach(DataReset::erase);
            forgetEvents();
        });
        deleteFiles();
        List<String> hints = new ArrayList<>();
        for (DataReset module : modules) {
            afterErase(module).ifPresent(hints::add);
        }
        log.warn("Full reset done; the data before it is in the backup {}", backup.name());
        return new ResetResult(backup.name(), hints);
    }

    /** The event publication registry of Spring Modulith: events about the deleted data must not come back. */
    private void forgetEvents() {
        List<String> tables = jdbc.sql("""
                select table_name from information_schema.tables
                where table_schema = 'PUBLIC' and table_name like 'EVENT_PUBLICATION%'
                """).query(String.class).list();
        for (String table : tables) {
            jdbc.sql("delete from \"" + table.replace("\"", "") + "\"").update();
        }
    }

    private void deleteFiles() {
        if (!Files.isDirectory(files)) {
            return;
        }
        try (Stream<Path> tree = Files.walk(files)) {
            for (Path path : tree.sorted(Comparator.reverseOrder()).filter(path -> !path.equals(files)).toList()) {
                Files.delete(path);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("The data is deleted, but not all files", e);
        }
    }

    private static Optional<String> afterErase(DataReset module) {
        try {
            return module.afterErase();
        } catch (RuntimeException e) {
            log.warn("Cleaning up after the reset failed in {}", module.getClass().getSimpleName(), e);
            return Optional.empty();
        }
    }
}

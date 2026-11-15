package ru.teacherbox.platform.backup;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** What {@link PendingRestore} leaves in {@code restore/} is deleted by {@link RestoreLeftovers}. */
class PendingRestoreLeftoversTest {

    private static final Instant NOW = Instant.parse("2026-11-15T10:00:00Z");

    @TempDir
    Path dataDir;

    private int keepDays = 14;
    private RestoreLeftovers leftovers;

    @BeforeEach
    void setUp() {
        leftovers = new RestoreLeftovers(dataDir, this::properties, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void nothingToDeleteWithoutRestoreDirectory() throws IOException {
        assertThat(leftovers.deleteExpired()).isZero();
    }

    @Test
    void deletesPreviousDataAndAppliedArchivesOlderThanTheDaysKept() throws IOException {
        Path oldPrevious = previous("previous-2026-10-01T10-00-00Z", NOW.minus(Duration.ofDays(15)));
        Path freshPrevious = previous("previous-2026-11-10T10-00-00Z", NOW.minus(Duration.ofDays(5)));
        Path oldApplied = file("applied/teacherbox-20261001-033000-000.zip", NOW.minus(Duration.ofDays(15)));
        Path freshApplied = file("applied/teacherbox-20261110-033000-000.zip", NOW.minus(Duration.ofDays(5)));
        Path oldFailed = file("failed/broken.zip", NOW.minus(Duration.ofDays(100)));
        Path result = file(PendingRestore.RESULT, NOW.minus(Duration.ofDays(100)));
        Path otherDir = previous("other", NOW.minus(Duration.ofDays(100)));

        assertThat(leftovers.deleteExpired()).isEqualTo(2);

        assertThat(oldPrevious).doesNotExist();
        assertThat(oldApplied).doesNotExist();
        assertThat(freshPrevious.resolve("db/teacherbox.mv.db")).exists();
        assertThat(freshApplied).exists();
        assertThat(oldFailed).as("failed archives stay").exists();
        assertThat(result).exists();
        assertThat(otherDir).exists();
    }

    @Test
    void theDaysKeptAreReadOnEveryRun() throws IOException {
        Path previous = previous("previous-2026-11-10T10-00-00Z", NOW.minus(Duration.ofDays(5)));
        assertThat(leftovers.deleteExpired()).isZero();

        keepDays = 3;
        assertThat(leftovers.deleteExpired()).isOne();
        assertThat(previous).doesNotExist();
    }

    @Test
    void lessThanADayKeepsADay() throws IOException {
        keepDays = 0;
        Path recent = file("applied/a.zip", NOW.minus(Duration.ofHours(12)));
        Path old = file("applied/b.zip", NOW.minus(Duration.ofHours(25)));

        leftovers.deleteExpired();

        assertThat(recent).exists();
        assertThat(old).doesNotExist();
    }

    @Test
    void runsAfterTheStartAndAFailureDoesNotStopIt() throws IOException {
        Path old = file("applied/a.zip", NOW.minus(Duration.ofDays(30)));
        leftovers.onApplicationEvent(null);
        assertThat(old).doesNotExist();

        RestoreLeftovers broken = new RestoreLeftovers(dataDir, () -> {
            throw new UncheckedIOException(new IOException("disk"));
        }, Clock.fixed(NOW, ZoneOffset.UTC));
        broken.onApplicationEvent(null);
    }

    private BackupProperties properties() {
        return new BackupProperties("-", keepDays, false, new BackupProperties.Google(null, "a", "o", "p", "u"));
    }

    private Path previous(String name, Instant modified) throws IOException {
        Path dir = dataDir.resolve("restore").resolve(name);
        Path db = dir.resolve("db/teacherbox.mv.db");
        Files.createDirectories(db.getParent());
        Files.writeString(db, "db");
        Files.setLastModifiedTime(dir, FileTime.from(modified));
        return dir;
    }

    private Path file(String name, Instant modified) throws IOException {
        Path file = dataDir.resolve("restore").resolve(name);
        Files.createDirectories(file.getParent());
        Files.writeString(file, "x");
        Files.setLastModifiedTime(file, FileTime.from(modified));
        return file;
    }
}

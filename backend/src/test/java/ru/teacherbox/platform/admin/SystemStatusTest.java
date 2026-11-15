package ru.teacherbox.platform.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.health.actuate.endpoint.HealthEndpoint;
import ru.teacherbox.shared.time.InstanceTimeZone;

class SystemStatusTest {

    @TempDir
    Path dataDir;

    @Test
    void sizesOfTheDataDirectoriesAndTheFreeSpace() throws IOException {
        write("db/teacherbox.mv.db", 100);
        write("files/homework/a.pdf", 20);
        write("files/boards/b.png", 30);
        write("backups/teacherbox-20261115-033000-000.zip", 70);
        write("restore/applied/teacherbox-20261101-033000-000.zip", 5);
        write("restore/previous-2026-11-01T10-00-00Z/db/teacherbox.mv.db", 6);

        SystemStatus.Status status = status().status();

        assertThat(status.dataSize()).isEqualTo(100);
        assertThat(status.filesSize()).isEqualTo(50);
        assertThat(status.backupsSize()).isEqualTo(70);
        assertThat(status.restoreSize()).isEqualTo(11);
        assertThat(status.diskFree()).isPositive();
        assertThat(status.diskTotal()).isGreaterThanOrEqualTo(status.diskFree());
        assertThat(status.health()).isEqualTo("UNKNOWN");
    }

    @Test
    void missingDirectoriesAreEmpty() {
        SystemStatus.Status status = status().status();

        assertThat(status.dataSize()).isZero();
        assertThat(status.filesSize()).isZero();
        assertThat(status.backupsSize()).isZero();
        assertThat(status.restoreSize()).isZero();
    }

    @SuppressWarnings("unchecked")
    private SystemStatus status() {
        return new SystemStatus(dataDir, new LogFiles(null), new InstanceTimeZone(ZoneOffset.UTC),
                mock(ObjectProvider.class), (ObjectProvider<HealthEndpoint>) mock(ObjectProvider.class),
                Clock.systemUTC());
    }

    private void write(String path, int bytes) throws IOException {
        Path file = dataDir.resolve(path);
        Files.createDirectories(file.getParent());
        Files.write(file, new byte[bytes]);
    }
}

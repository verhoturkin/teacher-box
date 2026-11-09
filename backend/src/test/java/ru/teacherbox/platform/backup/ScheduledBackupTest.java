package ru.teacherbox.platform.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.UncheckedIOException;
import java.io.IOException;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class ScheduledBackupTest {

    @Test
    void runsTheBackupAndSurvivesFailures() {
        BackupService backups = mock(BackupService.class);
        PlatformBackupAutoConfiguration.ScheduledBackup job = new PlatformBackupAutoConfiguration.ScheduledBackup(backups);

        job.run();
        verify(backups).create(BackupKind.SCHEDULED);

        when(backups.create(BackupKind.SCHEDULED)).thenThrow(new UncheckedIOException(new IOException("disk full")));
        assertThatCode(job::run).doesNotThrowAnyException();
    }

    @Test
    void keepsBackupsForADayAtLeast() {
        assertThat(new BackupProperties("-", 0, false, null).retention()).isEqualTo(Duration.ofDays(1));
        assertThat(new BackupProperties("-", 9, false, null).retention()).isEqualTo(Duration.ofDays(9));
    }
}

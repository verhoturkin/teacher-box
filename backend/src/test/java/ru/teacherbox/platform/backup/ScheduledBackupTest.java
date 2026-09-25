package ru.teacherbox.platform.backup;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.UncheckedIOException;
import java.io.IOException;
import org.junit.jupiter.api.Test;

class ScheduledBackupTest {

    @Test
    void runsTheBackupAndSurvivesFailures() {
        BackupService backups = mock(BackupService.class);
        PlatformBackupAutoConfiguration.ScheduledBackup job = new PlatformBackupAutoConfiguration.ScheduledBackup(backups);

        job.run();
        verify(backups).create();

        when(backups.create()).thenThrow(new UncheckedIOException(new IOException("disk full")));
        assertThatCode(job::run).doesNotThrowAnyException();
    }

    @Test
    void rejectsKeepingNoBackups() {
        assertThatThrownBy(() -> new BackupProperties("-", 0)).isInstanceOf(IllegalArgumentException.class);
    }
}

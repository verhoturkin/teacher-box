package ru.teacherbox.platform.backup.drive;

import java.util.List;
import ru.teacherbox.shared.diagnostics.IntegrationCheck;
import ru.teacherbox.shared.i18n.Language;

/** Checks the Google Drive of the backups (through the Google proxy if one is set). */
public class DriveIntegrationCheck implements IntegrationCheck {

    private final CloudBackupService drive;

    public DriveIntegrationCheck(CloudBackupService drive) {
        this.drive = drive;
    }

    @Override
    public List<IntegrationStatus> check() {
        // in the language of the administrator's page (ADR-0036)
        boolean russian = Language.current() == Language.RU;
        String name = russian ? "Google Диск (резервные копии)" : "Google Drive (backups)";
        long started = System.nanoTime();
        try {
            return List.of(drive.checkConnection()
                    ? new IntegrationStatus(name, State.OK, russian ? "Подключён" : "Connected", elapsed(started))
                    : IntegrationStatus.notConfigured(name, russian ? "Не подключён" : "Not connected"));
        } catch (DriveException e) {
            return List.of(new IntegrationStatus(name, State.FAILED, String.valueOf(e.getMessage()), elapsed(started)));
        }
    }

    private static long elapsed(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}

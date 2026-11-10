package ru.teacherbox.boards.application;

import org.springframework.stereotype.Component;
import ru.teacherbox.shared.time.ZonedJob;

/** Daily copies of the changed boards ({@code TEACHERBOX_BOARDS_BACKUP_CRON}, instance time zone). */
@Component
class BoardBackupJob implements ZonedJob {

    private final BoardBackupService backups;

    BoardBackupJob(BoardBackupService backups) {
        this.backups = backups;
    }

    @Override
    public String name() {
        return "board-backups";
    }

    @Override
    public String cronProperty() {
        return "teacherbox.boards.backup-cron";
    }

    @Override
    public String defaultCron() {
        return "0 0 3 * * *";
    }

    @Override
    public void run() {
        backups.dailyCopies();
    }
}

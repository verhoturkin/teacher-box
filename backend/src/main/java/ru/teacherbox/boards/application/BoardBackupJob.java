package ru.teacherbox.boards.application;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Daily copies of the changed boards ({@code TEACHERBOX_BOARDS_BACKUP_CRON}, instance time zone). */
@Component
class BoardBackupJob {

    private final BoardBackupService backups;

    BoardBackupJob(BoardBackupService backups) {
        this.backups = backups;
    }

    @Scheduled(cron = "${teacherbox.boards.backup-cron:0 0 3 * * *}", zone = "${teacherbox.timezone:Europe/Moscow}")
    void run() {
        backups.dailyCopies();
    }
}

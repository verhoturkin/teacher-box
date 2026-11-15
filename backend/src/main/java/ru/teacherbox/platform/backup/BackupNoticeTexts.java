package ru.teacherbox.platform.backup;

import ru.teacherbox.shared.i18n.Language;

/** Texts of the backup notices in each language (ADR-0036). */
enum BackupNoticeTexts {

    RU {
        @Override String backupFailed() { return "Резервная копия не создана"; }
        @Override String backupFailedBody() {
            return "Копия по расписанию не получилась. Создайте копию вручную в настройках; если не выйдет, "
                    + "напишите администратору портала — причина в его журнале.";
        }
        @Override String uploadFailed() { return "Копия не отправлена в Google Диск"; }
        @Override String uploadFailedBody(String name) {
            return "Копия " + name + " осталась только на сервере. Причина — в настройках, в разделе Google Диска; "
                    + "там же можно отправить копию ещё раз.";
        }
    },

    EN {
        @Override String backupFailed() { return "The backup was not made"; }
        @Override String backupFailedBody() {
            return "The scheduled backup failed. Make a backup by hand in Settings; if that fails too, contact the "
                    + "portal administrator — the reason is in their log.";
        }
        @Override String uploadFailed() { return "The backup did not reach Google Drive"; }
        @Override String uploadFailedBody(String name) {
            return "Backup " + name + " is only on the server. The reason is in Settings, under Google Drive, "
                    + "where you can also send it again.";
        }
    };

    static BackupNoticeTexts of(Language language) {
        return switch (language) {
            case RU -> RU;
            case EN -> EN;
        };
    }

    abstract String backupFailed();

    abstract String backupFailedBody();

    abstract String uploadFailed();

    abstract String uploadFailedBody(String name);
}

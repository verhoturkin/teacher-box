package ru.teacherbox.platform.backup;

import ru.teacherbox.shared.notice.NoticeKind;

/** What the backups notify the teacher about; the names are known to {@code notifications}. */
enum BackupNoticeKind implements NoticeKind {
    /** A scheduled backup was not made. */
    BACKUP_FAILED,
    /** A backup did not reach Google Drive. */
    BACKUP_UPLOAD_FAILED
}

package ru.teacherbox.platform.backup;

import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.support.TransactionOperations;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.notice.NoticeRecipients;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.notice.NoticeText;

/**
 * Tells the teacher that a scheduled backup or its upload to Google Drive failed (ADR-0061): the
 * platform writes the notice in every language and publishes {@link NoticeRequested}; the teacher
 * comes from {@link NoticeRecipients} of the identity module. A failure has no transaction of its own,
 * so the notice is published in a new one: the event registry keeps it for {@code notifications}.
 * Notifying never fails the caller.
 */
public class BackupFailures {

    /** Where the teacher makes a backup by hand and sees the state of Google Drive. */
    static final String SETTINGS_PAGE = "/teacher/settings#backups";
    private static final Logger log = LoggerFactory.getLogger(BackupFailures.class);

    private final Supplier<@Nullable NoticeRecipients> recipients;
    private final ApplicationEventPublisher events;
    private final TransactionOperations transactions;

    /** @param recipients absent when the identity module is not started (tests of the platform) */
    public BackupFailures(Supplier<@Nullable NoticeRecipients> recipients, ApplicationEventPublisher events,
            TransactionOperations transactions) {
        this.recipients = recipients;
        this.events = events;
        this.transactions = transactions;
    }

    /** A scheduled backup was not made. */
    public void backupFailed() {
        notifyTeacher(BackupNoticeKind.BACKUP_FAILED,
                language -> new NoticeText(texts(language).backupFailed(), texts(language).backupFailedBody()));
    }

    /** @param name the backup that stays on the server only */
    public void uploadFailed(String name) {
        notifyTeacher(BackupNoticeKind.BACKUP_UPLOAD_FAILED,
                language -> new NoticeText(texts(language).uploadFailed(), texts(language).uploadFailedBody(name)));
    }

    private void notifyTeacher(BackupNoticeKind kind, Function<Language, NoticeText> write) {
        try {
            NoticeRecipients known = recipients.get();
            Optional<UUID> teacher = known == null ? Optional.empty() : known.teacher();
            if (teacher.isEmpty()) {
                log.warn("No teacher to notify of {}", kind);
                return;
            }
            NoticeRequested notice = NoticeRequested.of(teacher.get(), kind, write, SETTINGS_PAGE);
            transactions.executeWithoutResult(status -> events.publishEvent(notice));
        } catch (RuntimeException e) {
            log.warn("Could not notify the teacher of {}", kind, e);
        }
    }

    private static BackupNoticeTexts texts(Language language) {
        return BackupNoticeTexts.of(language);
    }
}

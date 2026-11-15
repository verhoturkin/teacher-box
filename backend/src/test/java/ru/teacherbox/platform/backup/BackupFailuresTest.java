package ru.teacherbox.platform.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.support.TransactionOperations;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.notice.NoticeRecipients;
import ru.teacherbox.shared.notice.NoticeRequested;

/** The teacher learns of a failed backup or upload; notifying never fails the job. */
class BackupFailuresTest {

    private static final UUID TEACHER = UUID.fromString("00000000-0000-7000-8000-000000000001");
    private static final String NAME = "teacherbox-20261010-033000-000.zip";

    private final List<Object> published = new ArrayList<>();
    private final ApplicationEventPublisher events = published::add;

    @Test
    void aFailedBackupNotifiesTheTeacherInEveryLanguage() {
        failures(() -> Optional.of(TEACHER)).backupFailed();

        NoticeRequested notice = (NoticeRequested) published.getFirst();
        assertThat(notice.recipientId()).isEqualTo(TEACHER);
        assertThat(notice.kind()).isEqualTo("BACKUP_FAILED");
        assertThat(notice.link()).isEqualTo("/teacher/settings#backups");
        assertThat(notice.text(Language.RU).title()).isEqualTo("Резервная копия не создана");
        assertThat(notice.text(Language.EN).title()).isEqualTo("The backup was not made");
    }

    @Test
    void aFailedUploadNamesTheBackup() {
        failures(() -> Optional.of(TEACHER)).uploadFailed(NAME);

        NoticeRequested notice = (NoticeRequested) published.getFirst();
        assertThat(notice.kind()).isEqualTo("BACKUP_UPLOAD_FAILED");
        assertThat(notice.text(Language.RU).body()).contains(NAME);
        assertThat(notice.text(Language.EN).body()).contains(NAME);
    }

    @Test
    void theNoticeIsPublishedInATransaction() {
        TransactionOperations transactions = mock(TransactionOperations.class);
        new BackupFailures(() -> () -> Optional.of(TEACHER), events, transactions).backupFailed();

        verify(transactions).executeWithoutResult(any());
        assertThat(published).isEmpty();
    }

    @Test
    void nobodyIsNotifiedWithoutATeacher() {
        failures(Optional::empty).backupFailed();
        new BackupFailures(() -> null, events, TransactionOperations.withoutTransaction()).uploadFailed(NAME);

        assertThat(published).isEmpty();
    }

    @Test
    void aFailureToNotifyDoesNotReachTheJob() {
        ApplicationEventPublisher broken = mock(ApplicationEventPublisher.class);
        doThrow(new IllegalStateException("no database")).when(broken).publishEvent(any(Object.class));
        NoticeRecipients recipients = () -> {
            throw new IllegalStateException("no database");
        };

        assertThatCode(() -> new BackupFailures(() -> recipients, events, TransactionOperations.withoutTransaction())
                .backupFailed()).doesNotThrowAnyException();
        assertThatCode(() -> new BackupFailures(() -> () -> Optional.of(TEACHER), broken,
                TransactionOperations.withoutTransaction()).uploadFailed(NAME)).doesNotThrowAnyException();
        verify(broken).publishEvent(any(Object.class));
        assertThat(published).isEmpty();
    }

    private BackupFailures failures(NoticeRecipients recipients) {
        return new BackupFailures(() -> recipients, events, TransactionOperations.withoutTransaction());
    }
}

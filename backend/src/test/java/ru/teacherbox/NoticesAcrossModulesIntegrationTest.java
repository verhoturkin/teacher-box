package ru.teacherbox;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.support.TransactionTemplate;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.notifications.domain.InboxNotification;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.persistence.InboxRepository;
import ru.teacherbox.schedule.api.GoogleCalendarDisconnected;
import ru.teacherbox.schedule.api.LessonSummaryShared;

/**
 * The whole application (ADR-0061): a module's event, published in a transaction, becomes a notice
 * in that transaction and an inbox record after the commit — once, and not at all after a rollback.
 */
@SpringBootTest(properties = {
        "teacherbox.identity.teacher.login=teacher",
        "teacherbox.identity.teacher.password=correct-horse-battery"
})
class NoticesAcrossModulesIntegrationTest {

    @Autowired
    ApplicationEventPublisher events;

    @Autowired
    TransactionTemplate transactions;

    @Autowired
    InboxRepository inbox;

    @Autowired
    UserDirectory users;

    @Test
    void anEventOfAModuleReachesTheInboxAfterTheCommit() {
        UUID student = UUID.randomUUID();
        UUID lesson = UUID.randomUUID();

        transactions.executeWithoutResult(status -> {
            events.publishEvent(new LessonSummaryShared(lesson, List.of(student), users.teacherId(),
                    Instant.parse("2026-10-01T15:00:00Z"), Instant.now()));
            assertThat(inbox.findPage(student, 0, 10)).as("before the commit").isEmpty();
        });

        await().atMost(Duration.ofSeconds(10)).until(() -> !inbox.findPage(student, 0, 10).isEmpty());
        assertThat(inbox.findPage(student, 0, 10)).singleElement().satisfies(notification -> {
            assertThat(notification.kind()).isEqualTo(NotificationKind.LESSON_SUMMARY);
            assertThat(notification.link()).isEqualTo("/cabinet/schedule?lesson=" + lesson);
        });
    }

    @Test
    void aRolledBackChangeNotifiesNobody() {
        UUID teacher = users.teacherId();

        transactions.executeWithoutResult(status -> {
            events.publishEvent(new GoogleCalendarDisconnected("rolled back", Instant.now()));
            status.setRollbackOnly();
        });
        transactions.executeWithoutResult(
                status -> events.publishEvent(new GoogleCalendarDisconnected("committed", Instant.now())));

        await().atMost(Duration.ofSeconds(10)).until(() -> !calendarNotices(teacher).isEmpty());
        assertThat(calendarNotices(teacher)).as("only the committed one").hasSize(1);
    }

    private List<InboxNotification> calendarNotices(UUID teacher) {
        return inbox.findPage(teacher, 0, 100).stream()
                .filter(notification -> notification.kind() == NotificationKind.SCHEDULE_CALENDAR)
                .toList();
    }
}

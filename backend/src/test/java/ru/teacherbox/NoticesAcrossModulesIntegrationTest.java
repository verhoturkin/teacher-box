package ru.teacherbox;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.awaitility.Awaitility.await;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Currency;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.support.TransactionTemplate;
import ru.teacherbox.billing.api.PaymentRecorded;
import ru.teacherbox.homework.api.HomeworkAssigned;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.meetings.api.MeetingLinkShared;
import ru.teacherbox.notifications.domain.InboxNotification;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.persistence.InboxRepository;
import ru.teacherbox.schedule.api.GoogleCalendarDisconnected;
import ru.teacherbox.schedule.api.LessonSummaryShared;
import ru.teacherbox.shared.money.Money;

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

    /** Each module's notices reach the inbox: the kinds are the ones {@code notifications} knows. */
    @Test
    void everyModuleNotifiesThroughTheSameEvent() {
        UUID student = UUID.randomUUID();
        Money amount = Money.of(150_000, Currency.getInstance("RUB"));

        transactions.executeWithoutResult(status -> {
            events.publishEvent(new HomeworkAssigned(UUID.randomUUID(), UUID.randomUUID(), student, "Дроби", null,
                    Instant.now()));
            events.publishEvent(new PaymentRecorded(UUID.randomUUID(), student, amount, LocalDate.of(2026, 9, 24),
                    amount, Instant.now()));
            events.publishEvent(new MeetingLinkShared(student, null, List.of(student), "https://zoom.us/j/1",
                    Instant.now()));
        });

        await().atMost(Duration.ofSeconds(10)).until(() -> inbox.findPage(student, 0, 10).size() == 3);
        assertThat(inbox.findPage(student, 0, 10)).extracting(InboxNotification::kind, InboxNotification::title)
                .containsExactlyInAnyOrder(
                        tuple(NotificationKind.HOMEWORK_ASSIGNED, "Новое задание: «Дроби»"),
                        tuple(NotificationKind.PAYMENT_RECORDED, "Получена оплата 1 500 ₽"),
                        tuple(NotificationKind.MEETING_LINK, "Ссылка на урок"));
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

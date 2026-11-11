package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.modulith.events.core.EventSerializer;
import org.springframework.modulith.test.Scenario;
import org.springframework.transaction.support.TransactionTemplate;
import ru.teacherbox.notifications.application.NotificationService;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.InboxNotification;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.domain.NotificationTopic;
import ru.teacherbox.notifications.domain.Preferences;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.DeliveryRepository;
import ru.teacherbox.notifications.persistence.InboxRepository;
import ru.teacherbox.notifications.persistence.PreferencesRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.notice.NoticeKind;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.notice.NoticeText;
import ru.teacherbox.testing.FakeUserDirectory;

/** The notices the modules write (ADR-0061) become inbox records and deliveries. */
@NotificationsIntegrationTest
class NoticesIntegrationTests {

    private enum Kind implements NoticeKind { HOMEWORK_ASSIGNED, MEETING_LINK, SCHEDULE_REQUEST, LESSON_SUMMARY, UNHEARD_OF }

    @Autowired
    InboxRepository inbox;

    @Autowired
    DeliveryRepository deliveries;

    @Autowired
    ChannelLinkRepository links;

    @Autowired
    PreferencesRepository preferences;

    @Autowired
    NotificationService notifications;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    ApplicationEventPublisher events;

    @Autowired
    TransactionTemplate transactions;

    @Autowired
    EventSerializer serializer;

    @Test
    void aNoticeReachesTheInboxInTheRecipientsLanguage(Scenario scenario) {
        UUID russian = directory.addStudent("Мария");
        UUID english = directory.addStudent("Mary");
        directory.setLanguage(english, Language.EN);

        NoticeRequested first = notice(russian, Kind.HOMEWORK_ASSIGNED, "/cabinet/homework/1");
        NoticeRequested second = notice(english, Kind.HOMEWORK_ASSIGNED, "/cabinet/homework/1");
        scenario.publish(first).andWaitForStateChange(() -> inbox.findPage(russian, 0, 10), list -> !list.isEmpty())
                .andVerify(list -> assertThat(list).singleElement().satisfies(notification -> {
                    assertThat(notification.id()).isEqualTo(first.id());
                    assertThat(notification.kind()).isEqualTo(NotificationKind.HOMEWORK_ASSIGNED);
                    assertThat(notification.title()).isEqualTo("Заголовок");
                    assertThat(notification.body()).isEqualTo("Текст");
                    assertThat(notification.link()).isEqualTo("/cabinet/homework/1");
                    assertThat(notification.isRead()).isFalse();
                }));
        scenario.publish(second).andWaitForStateChange(() -> inbox.findPage(english, 0, 10), list -> !list.isEmpty())
                .andVerify(list -> assertThat(list).singleElement().satisfies(notification -> {
                    assertThat(notification.title()).isEqualTo("Title");
                    assertThat(notification.body()).isEqualTo("Body");
                }));
    }

    @Test
    void aRoomGoesAsAButtonAndTheBotOffersItsActions() {
        UUID student = connectedStudent("9301");
        NoticeRequested room = new NoticeRequested(Ids.newId(), student, "MEETING_LINK",
                NoticeText.inEveryLanguage(language -> new NoticeText("Ссылка на урок",
                        "По этой ссылке проходят наши уроки: https://zoom.us/j/1", "Здесь проходят наши уроки.")),
                "/cabinet/schedule", null, "https://zoom.us/j/1");

        notifications.notify(room);

        assertThat(inbox.findPage(student, 0, 10)).singleElement().satisfies(notification -> assertThat(
                notification.body()).isEqualTo("По этой ссылке проходят наши уроки: https://zoom.us/j/1"));
        assertThat(deliveries.findByRecipient(student)).singleElement().satisfies(delivery -> {
            assertThat(delivery.text()).isEqualTo("Ссылка на урок\nЗдесь проходят наши уроки.");
            assertThat(delivery.keyboard()).contains("Подключиться", "https://zoom.us/j/1", "Открыть");
        });

        UUID quiet = connectedStudent("9302");
        notifications.notify(new NoticeRequested(Ids.newId(), quiet, "MEETING_LINK",
                NoticeText.inEveryLanguage(language -> new NoticeText("Ссылка на урок", "https://zoom.us/j/2")),
                null, null, "https://zoom.us/j/2"));
        assertThat(deliveries.findByRecipient(quiet)).singleElement().satisfies(delivery -> {
            assertThat(delivery.text()).as("a room without a text for messengers: the title only")
                    .isEqualTo("Ссылка на урок");
            assertThat(delivery.keyboard()).contains("Подключиться").doesNotContain("Открыть");
        });

        UUID asked = connectedStudent("9303");
        notifications.notify(notice(asked, Kind.SCHEDULE_REQUEST, "/teacher/schedule")
                .about(new ChatSubject(TestChatActions.SUBJECT, UUID.randomUUID())));
        assertThat(deliveries.findByRecipient(asked)).singleElement().satisfies(delivery -> {
            assertThat(delivery.text()).isEqualTo("Заголовок\nТекст");
            assertThat(delivery.keyboard()).contains("Открыть", "Принять", "Отклонить");
        });
    }

    @Test
    void theKindDecidesWhatTheRecipientMuted() {
        assertThat(NotificationTopic.of(NotificationKind.LESSON_SUMMARY)).isEqualTo(NotificationTopic.LESSON_SUMMARY);
        assertThat(Preferences.DEFAULT.sendsToMessengers(NotificationKind.LESSON_SUMMARY)).isTrue();
        assertThat(new Preferences(Set.of(NotificationTopic.LESSON_SUMMARY), null, null)
                .sendsToMessengers(NotificationKind.LESSON_SUMMARY)).isFalse();
        UUID student = connectedStudent("9304");
        preferences.save(student, new Preferences(Set.of(NotificationTopic.LESSON_SUMMARY), null, null), Instant.now());

        notifications.notify(notice(student, Kind.LESSON_SUMMARY, null));
        assertThat(inbox.findPage(student, 0, 10)).hasSize(1);
        assertThat(deliveries.findByRecipient(student)).isEmpty();

        notifications.notify(notice(student, Kind.HOMEWORK_ASSIGNED, null));
        assertThat(inbox.findPage(student, 0, 10)).hasSize(2);
        assertThat(deliveries.findByRecipient(student)).hasSize(1);
    }

    @Test
    void aNoticeDeliveredAgainNotifiesOnce() {
        UUID student = connectedStudent("9305");
        NoticeRequested notice = notice(student, Kind.HOMEWORK_ASSIGNED, null);

        notifications.notify(notice);
        notifications.notify(notice);

        assertThat(inbox.findPage(student, 0, 10)).hasSize(1);
        assertThat(deliveries.findByRecipient(student)).hasSize(1);
    }

    @Test
    void aKindNotificationsDoNotKnowIsRefusedAndNothingIsStored() {
        UUID student = directory.addStudent("Неизвестный вид");

        assertThatThrownBy(() -> notifications.notify(notice(student, Kind.UNHEARD_OF, null)))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(inbox.findPage(student, 0, 10)).isEmpty();
    }

    /** As with the events of the modules before ADR-0061: nothing before the commit, nothing after a rollback. */
    @Test
    void aNoticeFollowsTheTransactionItWasPublishedIn(Scenario scenario) {
        UUID student = directory.addStudent("Транзакция");
        NoticeRequested dropped = notice(student, Kind.HOMEWORK_ASSIGNED, "/dropped");
        NoticeRequested kept = notice(student, Kind.HOMEWORK_ASSIGNED, "/kept");

        transactions.executeWithoutResult(status -> {
            events.publishEvent(dropped);
            status.setRollbackOnly();
        });
        scenario.stimulate(() -> transactions.executeWithoutResult(status -> {
                    events.publishEvent(kept);
                    assertThat(inbox.findPage(student, 0, 10)).as("before the commit").isEmpty();
                }))
                .andWaitForStateChange(() -> inbox.findPage(student, 0, 10), list -> !list.isEmpty())
                .andVerify(list -> assertThat(list).extracting(InboxNotification::link).containsExactly("/kept"));
        assertThat(inbox.findById(dropped.id())).isEmpty();
    }

    /** The registry stores a notice as text until it is delivered and reads it back after a restart. */
    @Test
    void aNoticeSurvivesTheEventRegistry() {
        NoticeRequested notice = new NoticeRequested(Ids.newId(), Ids.newId(), "MEETING_LINK",
                NoticeText.inEveryLanguage(language -> new NoticeText("Заголовок " + language, null, "Комната")),
                "/cabinet/schedule", new ChatSubject("sample", Ids.newId()), "https://zoom.us/j/1");
        NoticeRequested plain = notice(Ids.newId(), Kind.HOMEWORK_ASSIGNED, null);

        for (NoticeRequested each : List.of(notice, plain)) {
            Object stored = serializer.serialize(each);
            assertThat(serializer.deserialize(stored, NoticeRequested.class)).isEqualTo(each);
        }
    }

    private static NoticeRequested notice(UUID recipient, NoticeKind kind, String link) {
        return NoticeRequested.of(recipient, kind, language -> switch (language) {
            case RU -> new NoticeText("Заголовок", "Текст");
            case EN -> new NoticeText("Title", "Body");
        }, link);
    }

    private UUID connectedStudent(String chatId) {
        UUID student = directory.addStudent("Ученик " + chatId);
        links.save(new ChannelLink(Ids.newId(), student, ChannelType.TELEGRAM, chatId, null, true, Instant.now()));
        return student;
    }
}

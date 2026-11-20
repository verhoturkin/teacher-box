package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.notifications.application.ChannelService;
import ru.teacherbox.notifications.application.ChatEngine;
import ru.teacherbox.notifications.application.DeliveryDispatcher;
import ru.teacherbox.notifications.application.IncomingMessage;
import ru.teacherbox.notifications.application.NotificationService;
import ru.teacherbox.notifications.application.OutgoingButton;
import ru.teacherbox.notifications.application.OutgoingMessage;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.InboxNotification;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.DeliveryRepository;
import ru.teacherbox.notifications.persistence.InboxRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.notice.NoticeKind;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.notice.NoticeText;
import ru.teacherbox.testing.ChatSteps;
import ru.teacherbox.testing.FakeGuardians;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/**
 * A child's notices reach the child's guardians (ADR-0069): named with the child, linked into the family cabinet,
 * by the guardian's four categories; the guardian's settings, messengers and bot.
 */
@NotificationsIntegrationTest
class GuardianNoticesIntegrationTests {

    private enum Kind implements NoticeKind {
        SCHEDULE_REMINDER, PAYMENT_RECORDED, HOMEWORK_ASSIGNED, HOMEWORK_DUE_SOON, HOMEWORK_REVIEWED, SCHEDULE_REQUEST,
        SCHEDULE_REQUEST_ANSWERED
    }

    @Autowired
    NotificationService notifications;

    @Autowired
    InboxRepository inbox;

    @Autowired
    DeliveryRepository deliveries;

    @Autowired
    ChannelLinkRepository links;

    @Autowired
    ChannelService channels;

    @Autowired
    ChatEngine engine;

    @Autowired
    DeliveryDispatcher dispatcher;

    @Autowired
    FakeMessengerChannel telegram;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeGuardians guardians;

    @Autowired
    MutableClock clock;

    @Autowired
    MockMvcTester mvc;

    @BeforeEach
    void setUp() {
        clock.advance(Duration.ofSeconds(1));
        dispatcher.dispatch();
        telegram.reset();
    }

    @Test
    void aChildsNoticeReachesTheGuardiansNamedWithTheChildAndLinkedIntoTheFamilyCabinet() {
        UUID child = directory.addStudent("Петя Смирнов");
        UUID mother = guardians.addGuardian("Анна", child);
        UUID father = guardians.addGuardian("John", child);
        directory.setLanguage(father, Language.EN);
        connect(mother, "9601");
        NoticeRequested reminder = new NoticeRequested(Ids.newId(), child, Kind.SCHEDULE_REMINDER.name(),
                texts(), "/cabinet/schedule?lesson=7", new ChatSubject(TestChatActions.SUBJECT, Ids.newId()),
                "https://zoom.us/j/1");

        notifications.notify(reminder);

        assertThat(inbox.findPage(child, 0, 10)).singleElement().satisfies(notification -> {
            assertThat(notification.title()).isEqualTo("Заголовок");
            assertThat(notification.link()).isEqualTo("/cabinet/schedule?lesson=7");
        });
        assertThat(inbox.findPage(mother, 0, 10)).singleElement().satisfies(notification -> {
            assertThat(notification.kind()).isEqualTo(NotificationKind.SCHEDULE_REMINDER);
            assertThat(notification.title()).isEqualTo("Петя · Заголовок");
            assertThat(notification.body()).isEqualTo("Текст");
            assertThat(notification.link()).isEqualTo("/family/" + child + "/schedule?lesson=7");
        });
        assertThat(inbox.findPage(father, 0, 10)).extracting(InboxNotification::title)
                .containsExactly("Петя · Title");
        assertThat(deliveries.findByRecipient(mother)).singleElement().satisfies(delivery -> {
            assertThat(delivery.text()).isEqualTo("Петя · Заголовок\nТекст");
            assertThat(delivery.keyboard()).as("the child's room and buttons stay the child's")
                    .contains("Открыть", "https://school.example.com/family/" + child + "/schedule?lesson=7")
                    .doesNotContain("Подключиться", "Принять");
        });

        notifications.notify(reminder);
        assertThat(inbox.findPage(mother, 0, 10)).as("delivered again: once").hasSize(1);
        assertThat(inbox.findPage(child, 0, 10)).hasSize(1);
        assertThat(deliveries.findByRecipient(mother)).hasSize(1);
    }

    @Test
    void theAnswerToARequestReachesTheChildAndEachGuardianOnce() {
        UUID child = directory.addStudent("Соня");
        UUID mother = guardians.addGuardian("Мама Сони", child);
        connect(child, "9611");
        connect(mother, "9612");
        // the schedule writes one answer to the child, whoever sent the request (454.2)
        NoticeRequested answer = notice(child, Kind.SCHEDULE_REQUEST_ANSWERED, "/cabinet/schedule");

        notifications.notify(answer);
        notifications.notify(answer);

        assertThat(inbox.findPage(child, 0, 10)).singleElement().extracting(InboxNotification::title)
                .isEqualTo("Заголовок");
        assertThat(inbox.findPage(mother, 0, 10)).singleElement().satisfies(notification -> {
            assertThat(notification.kind()).isEqualTo(NotificationKind.SCHEDULE_REQUEST_ANSWERED);
            assertThat(notification.title()).isEqualTo("Соня · Заголовок");
            assertThat(notification.link()).isEqualTo("/family/" + child + "/schedule");
        });
        assertThat(deliveries.findByRecipient(child)).hasSize(1);
        assertThat(deliveries.findByRecipient(mother)).hasSize(1);
    }

    @Test
    void aGuardiansOnlyNoticeSkipsTheStudent() {
        UUID child = directory.addStudent("Скрытые оплаты");
        UUID guardian = guardians.addGuardian("Родитель", child);

        notifications.notify(notice(child, Kind.PAYMENT_RECORDED, "/cabinet/billing").toGuardiansOnly(true));

        assertThat(inbox.findPage(child, 0, 10)).isEmpty();
        assertThat(inbox.findPage(guardian, 0, 10)).singleElement()
                .satisfies(notification -> assertThat(notification.link()).isEqualTo("/family/" + child + "/billing"));
    }

    @Test
    void theGuardianGetsTheFourCategoriesAndSwitchesThemOff() {
        UUID child = directory.addStudent("Категории");
        UUID guardian = guardians.addGuardian("Родитель", child);

        notifications.notify(notice(child, Kind.HOMEWORK_ASSIGNED, "/cabinet/homework/1"));
        notifications.notify(notice(child, Kind.SCHEDULE_REQUEST, "/teacher/schedule"));
        assertThat(inbox.findPage(guardian, 0, 10)).as("not one of the four").isEmpty();

        assertThat(mvc.get().uri("/api/guardian/notifications/preferences").with(TestUsers.guardian(guardian)))
                .hasStatusOk().bodyJson().extractingPath("$.disabledCategories").asArray().isEmpty();
        assertThat(mvc.put().uri("/api/guardian/notifications/preferences").with(TestUsers.guardian(guardian))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"disabledCategories\":[\"REVIEWED_WORK\",\"PAYMENTS\"]}"))
                .hasStatusOk().bodyJson().extractingPath("$.disabledCategories").asArray()
                .containsExactly("PAYMENTS", "REVIEWED_WORK");
        assertThat(mvc.get().uri("/api/guardian/notifications/preferences").with(TestUsers.guardian(guardian)))
                .hasStatusOk().bodyJson().extractingPath("$.disabledCategories").asArray()
                .containsExactly("PAYMENTS", "REVIEWED_WORK");

        notifications.notify(notice(child, Kind.HOMEWORK_REVIEWED, "/cabinet/homework/2"));
        notifications.notify(notice(child, Kind.PAYMENT_RECORDED, "/cabinet/billing"));
        notifications.notify(notice(child, Kind.HOMEWORK_DUE_SOON, "/cabinet/homework/3"));
        assertThat(inbox.findPage(guardian, 0, 10)).extracting(InboxNotification::kind)
                .containsExactly(NotificationKind.HOMEWORK_DUE_SOON);
        assertThat(inbox.findPage(guardian, 0, 10)).extracting(InboxNotification::link)
                .containsExactly("/family/" + child + "/homework/3");
    }

    @Test
    void onlyAGuardianChoosesTheCategories() {
        UUID student = directory.addStudent("Не родитель");
        String uri = "/api/guardian/notifications/preferences";

        assertThat(mvc.get().uri(uri).with(TestUsers.student(student))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(uri).with(TestUsers.teacher(directory.teacherId())))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(uri)).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(mvc.put().uri(uri).with(TestUsers.guardian(Ids.newId())).contentType(MediaType.APPLICATION_JSON)
                .content("{\"disabledCategories\":[\"HOMEWORK\"]}")).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(mvc.put().uri(uri).with(TestUsers.guardian(Ids.newId())).contentType(MediaType.APPLICATION_JSON)
                .content("{}")).hasStatus(HttpStatus.BAD_REQUEST);
    }

    @Test
    void aHiddenChildsGuardianGetsNothingAndAGuardianWithoutChildrenNoMessengers() {
        UUID child = directory.addStudent("Деактивирован");
        UUID guardian = guardians.addGuardian("Родитель", child);
        connect(guardian, "9602");
        directory.setStatus(child, StudentStatus.DEACTIVATED);

        notifications.notify(notice(child, Kind.SCHEDULE_REMINDER, "/cabinet/schedule"));
        assertThat(inbox.findPage(guardian, 0, 10)).isEmpty();

        notifications.notify(guardian, NotificationKind.MESSAGE, "Сообщение", null, null);
        assertThat(inbox.findPage(guardian, 0, 10)).hasSize(1);
        assertThat(deliveries.findByRecipient(guardian)).as("no current children: inbox only").isEmpty();

        directory.setStatus(child, StudentStatus.ACTIVE);
        notifications.notify(notice(child, Kind.SCHEDULE_REMINDER, "/cabinet/account"));
        assertThat(inbox.findPage(guardian, 0, 10)).extracting(InboxNotification::link)
                .as("a cabinet page the family cabinet does not have: the child's home")
                .contains("/family/" + child);
        assertThat(deliveries.findByRecipient(guardian)).hasSize(1);
    }

    @Test
    void aGuardianConnectsAMessengerAndTalksToTheBot() {
        UUID child = directory.addStudent("Ребёнок бота");
        UUID guardian = guardians.addGuardian("Родитель бота", child);

        String code = channels.createLinkCode(guardian, ChannelType.TELEGRAM).code();
        assertThat(say("9603", code).text()).startsWith("Готово!");
        assertThat(links.find(guardian, ChannelType.TELEGRAM)).isPresent();

        OutgoingMessage menu = say("9603", "/menu");
        assertThat(labels(menu)).as("only the actions open to everyone").containsExactly("Отзыв");
        OutgoingMessage help = say("9603", "/help");
        assertThat(help.rows().getFirst().getFirst().url())
                .isEqualTo("https://school.example.com/family/" + child + "/help/bot");

        guardians.unlink(guardian, child);
        assertThat(say("9603", "/menu").text()).isEqualTo("Доступ к порталу отключён.");
    }

    private OutgoingMessage say(String externalId, String text) {
        return engine.handle(ChannelType.TELEGRAM, new IncomingMessage(externalId, null, text));
    }

    private static List<String> labels(OutgoingMessage message) {
        return message.rows().stream().flatMap(List::stream).map(OutgoingButton::label).map(ChatSteps::plain).toList();
    }

    private void connect(UUID recipient, String externalId) {
        links.save(new ChannelLink(Ids.newId(), recipient, ChannelType.TELEGRAM, externalId, null, true,
                Instant.now()));
    }

    private static Map<Language, NoticeText> texts() {
        return NoticeText.inEveryLanguage(language -> switch (language) {
            case RU -> new NoticeText("Заголовок", "Текст");
            case EN -> new NoticeText("Title", "Body");
        });
    }

    private static NoticeRequested notice(UUID recipient, NoticeKind kind, String link) {
        return NoticeRequested.of(recipient, kind, language -> switch (language) {
            case RU -> new NoticeText("Заголовок", "Текст");
            case EN -> new NoticeText("Title", "Body");
        }, link);
    }
}

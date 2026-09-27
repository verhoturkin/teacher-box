package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.notifications.application.ButtonPress;
import ru.teacherbox.notifications.application.ChannelService;
import ru.teacherbox.notifications.application.ChatEngine;
import ru.teacherbox.notifications.application.ChatSettingsService;
import ru.teacherbox.notifications.application.DeliveryDispatcher;
import ru.teacherbox.notifications.application.IncomingMessage;
import ru.teacherbox.notifications.application.NotificationService;
import ru.teacherbox.notifications.application.NotificationsHousekeeping;
import ru.teacherbox.notifications.application.OutgoingButton;
import ru.teacherbox.notifications.application.OutgoingMessage;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;
import ru.teacherbox.testing.TestUsers;

/** Dialogs with the bot: menu by role, steps, «Отмена», stale buttons, accounts, buttons under notifications. */
@NotificationsIntegrationTest
@ExtendWith(OutputCaptureExtension.class)
class ChatEngineIntegrationTests {

    @Autowired
    ChatEngine engine;

    @Autowired
    ChannelService channels;

    @Autowired
    ChannelLinkRepository links;

    @Autowired
    NotificationService notifications;

    @Autowired
    DeliveryDispatcher dispatcher;

    @Autowired
    NotificationsHousekeeping housekeeping;

    @Autowired
    ChatSettingsService settings;

    @Autowired
    FakeMessengerChannel telegram;

    @Autowired
    TestChatActions.Feedback feedback;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    MutableClock clock;

    @Autowired
    MockMvcTester mvc;

    @BeforeEach
    void setUp() {
        clock.advance(Duration.ofSeconds(1));
        settings.setTeacherActions(true);
        dispatcher.dispatch();
        telegram.reset();
    }

    @Test
    void connectsWithACodeAndShowsTheMenuOfTheRole() {
        UUID student = directory.addStudent("Мария");
        assertThat(say("8001", "/menu").text()).contains("отправьте сюда полученный код");
        assertThat(say("8001", "/menu").rows()).isEmpty();

        String code = channels.createLinkCode(student, ChannelType.TELEGRAM).code();
        OutgoingMessage linked = say("8001", code);
        assertThat(linked.text()).startsWith("Готово!");

        OutgoingMessage menu = press("8001", linked, "Меню");
        assertThat(menu.text()).isEqualTo("Что вы хотите сделать?");
        assertThat(labels(menu)).containsExactly("Отзыв", "Сломано");
        assertThat(say("8001", "/menu@test_bot").text()).isEqualTo("Что вы хотите сделать?");
        assertThat(say("8001", "Начать").text()).isEqualTo("Что вы хотите сделать?");

        UUID teacher = directory.teacherId();
        connect(teacher, "8002");
        OutgoingMessage teacherMenu = say("8002", "/start");
        assertThat(teacherMenu.text()).isEqualTo("Что сделать?");
        assertThat(labels(teacherMenu)).containsExactly("Отзыв", "Для учителя");
        assertThat(press("8002", teacherMenu, "Для учителя").text()).isEqualTo("Только учителю");

        OutgoingMessage stopped = say("8001", "/stop");
        assertThat(stopped.text()).startsWith("Уведомления отключены");
        assertThat(stopped.rows()).isEmpty();
    }

    @Test
    void walksThroughTheStepsOfAnAction(CapturedOutput output) {
        UUID student = directory.addStudent("Анна");
        connect(student, "8101");

        OutgoingMessage asked = press("8101", say("8101", "/menu"), "Отзыв");
        assertThat(asked.text()).isEqualTo("Напишите отзыв");
        assertThat(labels(asked)).containsExactly("Отмена");
        assertThat(labels(press("8101", asked, "Отмена"))).contains("Отзыв");

        press("8101", say("8101", "/menu"), "Отзыв");
        OutgoingMessage confirm = say("8101", "Всё понятно");
        assertThat(confirm.text()).isEqualTo("Отправить «Всё понятно»?");
        assertThat(labels(confirm)).containsExactly("Да", "Нет", "Отмена");
        OutgoingMessage done = press("8101", confirm, "Да");
        assertThat(done.text()).isEqualTo("Спасибо!");
        assertThat(done.rows().getFirst().getFirst()).isEqualTo(new OutgoingButton("Портал", null,
                "https://school.example.com"));
        assertThat(labels(done)).containsExactly("Портал", "Меню");
        assertThat(feedback.saved()).contains(student + " Всё понятно");

        OutgoingMessage again = press("8101", confirm, "Да");
        assertThat(again.text()).startsWith("Эта кнопка уже не действует.");
        assertThat(feedback.saved()).filteredOn(text -> text.startsWith(student.toString())).hasSize(1);
        assertThat(output).doesNotContain("via TELEGRAM bot: test.feedback feedback-saved");

        assertThat(say("8101", "просто текст").text()).startsWith("Не понял сообщение.");
    }

    @Test
    void cancelsAndForgetsAnAbandonedDialog() {
        UUID student = directory.addStudent("Вера");
        connect(student, "8201");

        press("8201", say("8201", "/menu"), "Отзыв");
        assertThat(say("8201", "/cancel").text()).startsWith("Действие отменено.");
        assertThat(say("8201", "текст после отмены").text()).startsWith("Не понял сообщение.");

        press("8201", say("8201", "/menu"), "Отзыв");
        assertThat(say("8201", "Отмена").text()).startsWith("Действие отменено.");

        press("8201", say("8201", "/menu"), "Отзыв");
        clock.advance(Duration.ofMinutes(31));
        assertThat(say("8201", "поздно").text()).startsWith("Не понял сообщение.");

        OutgoingMessage help = say("8201", "/help");
        assertThat(help.text()).contains("Бот умеет:", "• Отзыв", "/cancel");
        assertThat(labels(help)).containsExactly("Меню");
    }

    @Test
    void apologisesWhenAnActionFails() {
        UUID student = directory.addStudent("Глеб");
        connect(student, "8301");

        OutgoingMessage how = press("8301", say("8301", "/menu"), "Сломано");
        assertThat(press("8301", how, "Упасть").text()).startsWith("Не получилось");
        how = press("8301", say("8301", "/menu"), "Сломано");
        assertThat(press("8301", how, "Отказать").text()).startsWith("Не получилось");
        assertThat(say("8301", "ещё текст").text()).startsWith("Не понял сообщение.");
    }

    @Test
    void refusesStrangersStaleButtonsAndStudentsWithoutAccess() {
        UUID student = directory.addStudent("Дина");
        connect(student, "8401");
        OutgoingMessage menu = say("8401", "/menu");

        OutgoingMessage foreign = engine.handle(ChannelType.TELEGRAM,
                new IncomingMessage("8499", null, "", new ButtonPress(menu.rows().getFirst().getFirst().data(), null, null, null)));
        assertThat(foreign.text()).contains("отправьте сюда полученный код");
        assertThat(pressData("8401", "garbage").text()).startsWith("Эта кнопка уже не действует.");
        assertThat(pressData("8401", "AAAAAAAAAAAA:0").text()).startsWith("Эта кнопка уже не действует.");

        OutgoingMessage fresh = say("8401", "/menu");
        clock.advance(Duration.ofDays(3));
        assertThat(press("8401", fresh, "Отзыв").text()).startsWith("Эта кнопка уже не действует.");

        OutgoingMessage beforeDeactivation = say("8401", "/menu");
        directory.setStatus(student, StudentStatus.DEACTIVATED);
        assertThat(say("8401", "/menu").text()).isEqualTo("Доступ к порталу отключён.");
        assertThat(press("8401", beforeDeactivation, "Отзыв").text()).isEqualTo("Доступ к порталу отключён.");
        directory.setStatus(student, StudentStatus.ACTIVE);
    }

    @Test
    void asksWhoseAccountAParentActsFor() {
        UUID first = directory.addStudent("Первый");
        UUID second = directory.addStudent("Второй");
        connect(first, "8501");
        connect(second, "8501");

        OutgoingMessage choose = say("8501", "/menu");
        assertThat(choose.text()).isEqualTo("К этому чату подключено несколько аккаунтов. От чьего имени продолжить?");
        assertThat(labels(choose)).containsExactlyInAnyOrder("Первый", "Второй");

        OutgoingMessage menu = press("8501", choose, "Второй");
        assertThat(menu.text()).startsWith("Вы действуете от имени: Второй.");
        assertThat(labels(menu)).containsExactly("Отзыв", "Сломано", "Сменить аккаунт");

        press("8501", press("8501", say("8501", "/menu"), "Отзыв"), "Отмена");
        press("8501", say("8501", "/menu"), "Отзыв");
        press("8501", say("8501", "Отзыв второго"), "Да");
        assertThat(feedback.saved()).contains(second + " Отзыв второго");

        OutgoingMessage switched = press("8501", say("8501", "/menu"), "Сменить аккаунт");
        assertThat(labels(switched)).containsExactlyInAnyOrder("Первый", "Второй");
        assertThat(pressData("8501", switched.rows().getFirst().getFirst().data()).text())
                .startsWith("Вы действуете от имени:");

        links.delete(first, ChannelType.TELEGRAM);
        links.delete(second, ChannelType.TELEGRAM);
    }

    @Test
    void theTeacherCanSwitchOffManagingThroughTheBot(CapturedOutput output) {
        connect(directory.teacherId(), "8601");
        OutgoingMessage menu = say("8601", "/menu");
        press("8601", menu, "Отзыв");
        OutgoingMessage confirm = say("8601", "Отзыв учителя");
        press("8601", confirm, "Да");
        assertThat(output).contains("Teacher " + directory.teacherId() + " via TELEGRAM bot: test.feedback feedback-saved");

        assertThat(mvc.get().uri("/api/teacher/notifications/bot").with(TestUsers.teacher(directory.teacherId())))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.teacherActions").isEqualTo(true);
                    assertThat(json).extractingPath("$.teacherMenu").asArray().containsExactly("Отзыв", "Для учителя");
                    assertThat(json).extractingPath("$.studentMenu").asArray().containsExactly("Отзыв", "Сломано");
                });
        OutgoingMessage oldMenu = say("8601", "/menu");
        assertThat(mvc.put().uri("/api/teacher/notifications/bot").with(TestUsers.teacher(directory.teacherId()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"teacherActions\":false}"))
                .hasStatusOk().bodyJson().extractingPath("$.teacherActions").isEqualTo(false);

        assertThat(say("8601", "/menu").text()).startsWith("Управление порталом через бота выключено");
        assertThat(press("8601", oldMenu, "Отзыв").text()).startsWith("Управление порталом через бота выключено");
        assertThat(say("8601", "/help").text()).contains("Пока бот только присылает уведомления");
        assertThat(say("8601", "что-то").text()).startsWith("Не понял сообщение.\nУправление");

        UUID student = directory.addStudent("Любопытный");
        assertThat(mvc.get().uri("/api/teacher/notifications/bot").with(TestUsers.student(student)))
                .hasStatus(HttpStatus.FORBIDDEN);
        links.delete(directory.teacherId(), ChannelType.TELEGRAM);
    }

    @Test
    void putsTheButtonsOfAnActionUnderANotification() {
        UUID student = directory.addStudent("Ева");
        connect(student, "8701");
        UUID subject = UUID.randomUUID();

        notifications.notify(student, NotificationKind.MESSAGE, "Запрос", null, null, new ChatSubject(TestChatActions.SUBJECT, subject));
        notifications.notify(student, NotificationKind.MESSAGE, "Без кнопок", null, null, new ChatSubject("other", subject));
        dispatcher.dispatch();

        List<FakeMessengerChannel.Sent> sent = telegram.sent();
        assertThat(sent).hasSize(2);
        assertThat(sent.getFirst().labels()).containsExactly("Принять", "Отклонить");
        assertThat(sent.get(1).rows()).isEmpty();
        OutgoingMessage accepted = pressData("8701", sent.getFirst().button("Принять"));
        assertThat(accepted.text()).isEqualTo("Принято: " + subject);
        assertThat(pressData("8701", sent.getFirst().button("Отклонить")).text()).startsWith("Эта кнопка уже не действует.");

        connect(directory.teacherId(), "8702");
        settings.setTeacherActions(false);
        notifications.notify(directory.teacherId(), NotificationKind.MESSAGE, "Учителю", null, null,
                new ChatSubject(TestChatActions.SUBJECT, subject));
        dispatcher.dispatch();
        assertThat(telegram.lastSent().rows()).isEmpty();
        links.delete(directory.teacherId(), ChannelType.TELEGRAM);
    }

    @Test
    void housekeepingRemovesExpiredButtons() {
        UUID student = directory.addStudent("Жанна");
        connect(student, "8801");
        OutgoingMessage menu = say("8801", "/menu");

        clock.advance(Duration.ofDays(3));
        housekeeping.purge(clock.instant());

        clock.advance(Duration.ofDays(-3));
        assertThat(press("8801", menu, "Отзыв").text()).startsWith("Эта кнопка уже не действует.");
        clock.advance(Duration.ofDays(3));
    }

    private void connect(UUID recipient, String externalId) {
        links.save(new ChannelLink(Ids.newId(), recipient, ChannelType.TELEGRAM, externalId, "@user", true,
                clock.instant()));
    }

    private OutgoingMessage say(String externalId, String text) {
        return engine.handle(ChannelType.TELEGRAM, new IncomingMessage(externalId, null, text));
    }

    private OutgoingMessage press(String externalId, OutgoingMessage message, String label) {
        String data = message.rows().stream()
                .flatMap(List::stream)
                .filter(button -> button.label().equals(label) && button.data() != null)
                .map(OutgoingButton::data)
                .findFirst()
                .orElseThrow(() -> new AssertionError("No button «" + label + "» in " + message));
        return pressData(externalId, data);
    }

    private OutgoingMessage pressData(String externalId, String data) {
        return engine.handle(ChannelType.TELEGRAM,
                new IncomingMessage(externalId, null, "", new ButtonPress(data, "callback", null, null)));
    }

    private static List<String> labels(OutgoingMessage message) {
        return message.rows().stream().flatMap(List::stream).map(OutgoingButton::label).toList();
    }
}

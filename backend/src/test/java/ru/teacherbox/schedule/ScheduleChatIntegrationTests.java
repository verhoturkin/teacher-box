package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.testing.ChatSteps.action;
import static ru.teacherbox.testing.ChatSteps.ask;
import static ru.teacherbox.testing.ChatSteps.done;
import static ru.teacherbox.testing.ChatSteps.labels;
import static ru.teacherbox.testing.ChatSteps.url;
import static ru.teacherbox.testing.ChatSteps.value;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.application.ChangeRequestService;
import ru.teacherbox.schedule.application.ScheduleQueries;
import ru.teacherbox.schedule.application.ScheduleService;
import ru.teacherbox.schedule.application.ScheduleService.CancelLesson;
import ru.teacherbox.schedule.application.ScheduleService.PlanLesson;
import ru.teacherbox.schedule.application.ScheduleViews.RequestView;
import ru.teacherbox.schedule.domain.RequestStatus;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatKit;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.security.Role;
import ru.teacherbox.testing.FakeMeetingRooms;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;

/** A student's schedule in the messenger bot: lessons, cancelling, moving, requests (ADR-0013). */
@ScheduleIntegrationTest
class ScheduleChatIntegrationTests {

    private static final ZoneId MOSCOW = ZoneId.of("Europe/Moscow");

    @Autowired
    List<ChatAction> actions;

    @Autowired
    ScheduleService schedule;

    @Autowired
    ChangeRequestService requests;

    @Autowired
    ScheduleQueries queries;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    FakeMeetingRooms rooms;

    @Autowired
    MutableClock clock;

    @Test
    void showsTheUpcomingLessonsAndTheLinkToTheNearest() {
        UUID anna = directory.addStudent("Анна");
        ChatUser user = new ChatUser(anna, Role.STUDENT);
        ChatAction lessons = action(actions, "schedule.lessons");
        assertThat(lessons.availableTo(user)).isTrue();
        assertThat(lessons.availableTo(new ChatUser(directory.teacherId(), Role.TEACHER))).isFalse();
        assertThat(done(lessons.start(user)).reply().text()).isEqualTo("Запланированных занятий пока нет.");

        UUID group = groups.addGroup("ОГЭ", anna);
        UUID own = plan(anna, null, Slots.next(clock), "Дроби");
        UUID groupLesson = plan(null, group, Slots.next(clock), null);
        rooms.put(anna, "https://telemost.yandex.ru/j/1");
        requests.request(anna, own, ChangeKind.RESCHEDULE, Slots.next(clock), null);

        ChatStep.Done shown = done(lessons.next(user, ChatState.EMPTY, new ChatInput.Text("ещё")));
        assertThat(shown.reply().text()).startsWith("Ближайшие занятия:")
                .contains("— Дроби (ваш запрос ждёт ответа)", "— группа «ОГЭ»");
        assertThat(url(shown, "Войти на ближайший урок")).isEqualTo("https://telemost.yandex.ru/j/1");

        requests.request(anna, groupLesson, ChangeKind.CANCEL, null, null);
        assertThat(lessons.start(user).reply().text()).contains("группа «ОГЭ» (вы предупредили, что не придёте)");
    }

    @Test
    void asksTheTeacherToMoveALesson() {
        UUID boris = directory.addStudent("Борис");
        ChatUser user = new ChatUser(boris, Role.STUDENT);
        ChatAction move = action(actions, "schedule.move");
        assertThat(done(move.start(user)).reply().text()).startsWith("Нет занятий, которые можно перенести");
        Instant startsAt = Slots.next(clock);
        UUID lesson = plan(boris, null, startsAt, null);

        ChatStep.Ask which = ask(move.start(user));
        assertThat(which.reply().text()).isEqualTo("Какое занятие перенести?");
        assertThat(labels(which)).hasSize(1);
        ChatStep.Ask again = ask(move.next(user, which.state(), new ChatInput.Text("это")));
        assertThat(again.reply().text()).startsWith("Выберите занятие кнопкой.");

        ChatStep.Ask day = ask(move.next(user, which.state(), new ChatInput.Choice(value(which, ""))));
        assertThat(day.reply().text()).startsWith("На какой день перенести?");
        assertThat(labels(day)).hasSize(ChatKit.MAX_BUTTONS - 2);
        assertThat(ask(move.next(user, day.state(), new ChatInput.Text("когда-нибудь"))).reply().text())
                .startsWith("Не понял дату.");
        LocalDate newDay = LocalDate.ofInstant(clock.instant(), MOSCOW).plusDays(3);
        ChatStep.Ask time = ask(move.next(user, day.state(), new ChatInput.Choice("date:" + newDay)));
        assertThat(time.reply().text()).isEqualTo("Во сколько? Напишите время, например 18:30.");
        assertThat(ask(move.next(user, time.state(), new ChatInput.Text("вечером"))).reply().text())
                .startsWith("Не понял время.");

        ChatStep.Ask comment = ask(move.next(user, time.state(), new ChatInput.Text("18:30")));
        assertThat(labels(comment)).containsExactly("Без комментария");
        assertThat(ask(move.next(user, comment.state(), new ChatInput.Text("x".repeat(501)))).reply().text())
                .startsWith("Слишком длинно");
        ChatStep.Ask confirm = ask(move.next(user, comment.state(), new ChatInput.Text("Уезжаю")));
        assertThat(confirm.reply().text()).startsWith("Попросить учителя перенести занятие ")
                .contains(" на ", "18:30?", "Комментарий: Уезжаю");

        ChatStep.Done sent = done(move.next(user, confirm.state(), new ChatInput.Choice(ChatKit.YES)));
        assertThat(sent.reply().text()).isEqualTo("Запрос отправлен учителю. Ответ придёт сюда.");
        assertThat(sent.audit()).startsWith("change-request ");
        RequestView request = queries.studentRequests(boris).getFirst();
        assertThat(request.lessonId()).isEqualTo(lesson);
        assertThat(request.kind()).isEqualTo(ChangeKind.RESCHEDULE);
        assertThat(request.proposedStartsAt()).isEqualTo(newDay.atTime(LocalTime.of(18, 30)).atZone(MOSCOW).toInstant());
        assertThat(request.comment()).isEqualTo("Уезжаю");

        assertThat(done(move.next(user, confirm.state(), new ChatInput.Choice(ChatKit.YES))).reply().text())
                .startsWith("Это занятие уже нельзя изменить");
        assertThat(done(move.start(user)).reply().text()).startsWith("Нет занятий, которые можно перенести");
    }

    @Test
    void refusesATimeThatHasPassed() {
        UUID vera = directory.addStudent("Вера");
        ChatUser user = new ChatUser(vera, Role.STUDENT);
        plan(vera, null, Slots.next(clock), null);
        ChatAction move = action(actions, "schedule.move");

        ChatStep.Ask which = ask(move.start(user));
        ChatStep.Ask day = ask(move.next(user, which.state(), new ChatInput.Choice(value(which, ""))));
        ChatStep.Ask time = ask(move.next(user, day.state(), new ChatInput.Text("сегодня")));
        ChatStep.Ask again = ask(move.next(user, time.state(), new ChatInput.Text("00:00")));
        assertThat(again.reply().text()).startsWith("Это время уже прошло.");
        assertThat(again.state().step()).isEqualTo("date");
        assertThat(ask(move.next(user, ChatState.EMPTY.withStep("unknown"), new ChatInput.Text("?"))).state().step())
                .isEqualTo("lesson");
        assertThat(ask(move.next(user, ChatState.EMPTY, new ChatInput.Text("?"))).state().step()).isEqualTo("lesson");
    }

    @Test
    void cancelsALessonAndWarnsWhenItIsLate() {
        UUID gleb = directory.addStudent("Глеб");
        ChatUser user = new ChatUser(gleb, Role.STUDENT);
        Instant soon = clock.instant().truncatedTo(ChronoUnit.HOURS).plus(Duration.ofHours(3));
        UUID lesson = plan(gleb, null, soon, null);
        ChatAction cancel = action(actions, "schedule.cancel");

        ChatStep.Ask which = ask(cancel.start(user));
        assertThat(which.reply().text()).isEqualTo("Какое занятие отменить?");
        ChatStep.Ask comment = ask(cancel.next(user, which.state(), new ChatInput.Choice("lesson:" + lesson)));
        assertThat(comment.reply().text()).startsWith("Напишите причину");
        assertThat(ask(cancel.next(user, comment.state(), new ChatInput.Text(" "))).reply().text())
                .startsWith("Напишите причину");
        ChatStep.Ask confirm = ask(cancel.next(user, comment.state(), new ChatInput.Choice("skip")));
        assertThat(confirm.reply().text()).startsWith("Попросить учителя отменить занятие ")
                .contains("учитель может засчитать его как пропуск").doesNotContain("Комментарий");
        assertThat(done(cancel.next(user, confirm.state(), new ChatInput.Choice(ChatKit.NO))).reply().text())
                .isEqualTo("Хорошо, ничего не отправляю.");

        assertThat(done(cancel.next(user, confirm.state(), new ChatInput.Text("да"))).reply().text())
                .isEqualTo("Запрос отправлен учителю. Ответ придёт сюда.");
        assertThat(queries.studentRequests(gleb).getFirst().kind()).isEqualTo(ChangeKind.CANCEL);
    }

    @Test
    void aStudentOfAGroupSaysTheyWillNotCome() {
        UUID dina = directory.addStudent("Дина");
        UUID other = directory.addStudent("Егор");
        UUID group = groups.addGroup("Английский", dina, other);
        UUID lesson = plan(null, group, Slots.next(clock), null);
        ChatUser user = new ChatUser(dina, Role.STUDENT);
        ChatAction cancel = action(actions, "schedule.cancel");

        ChatStep.Ask which = ask(cancel.start(user));
        assertThat(labels(which).getFirst()).endsWith(" · Английский");
        ChatStep.Ask comment = ask(cancel.next(user, which.state(), new ChatInput.Choice("lesson:" + lesson)));
        ChatStep.Ask confirm = ask(cancel.next(user, comment.state(), new ChatInput.Text("Болею")));
        assertThat(confirm.reply().text())
                .startsWith("Сообщить учителю, что вы не придёте на занятие группы «Английский» ")
                .contains("Комментарий: Болею");

        assertThat(done(cancel.next(user, confirm.state(), new ChatInput.Choice(ChatKit.YES))).reply().text())
                .isEqualTo("Готово: учитель увидит, что вас не будет.");
        assertThat(queries.studentRequests(dina).getFirst().status()).isEqualTo(RequestStatus.APPROVED);
        assertThat(done(cancel.start(user)).reply().text()).startsWith("Нет занятий, которые можно отменить");
        assertThat(ask(cancel.start(new ChatUser(other, Role.STUDENT))).reply().text())
                .isEqualTo("Какое занятие отменить?");
    }

    @Test
    void showsAndWithdrawsRequests() {
        UUID zhanna = directory.addStudent("Жанна");
        ChatUser user = new ChatUser(zhanna, Role.STUDENT);
        ChatAction mine = action(actions, "schedule.requests");
        assertThat(done(mine.start(user)).reply().text()).isEqualTo("Запросов пока нет.");
        UUID first = plan(zhanna, null, Slots.next(clock), null);
        UUID second = plan(zhanna, null, Slots.next(clock), null);
        RequestView declined = requests.request(zhanna, first, ChangeKind.RESCHEDULE, Slots.next(clock), null);
        requests.decline(declined.id(), "Давай в среду");
        RequestView pending = requests.request(zhanna, second, ChangeKind.CANCEL, null, "Болею");

        ChatStep.Ask list = ask(mine.start(user));
        assertThat(list.reply().text()).startsWith("Ваши запросы:")
                .contains("отмена занятия", "— ждёт ответа", "перенос занятия", " на ", "— отклонён",
                        "Учитель: «Давай в среду»", "Запрос без ответа можно отозвать.");
        assertThat(labels(list)).singleElement().asString().startsWith("Отозвать: ");
        assertThat(mine.next(user, list.state(), new ChatInput.Text("что?")).reply().text()).startsWith("Ваши запросы:");

        ChatStep.Ask confirm = ask(mine.next(user, list.state(), new ChatInput.Choice(value(list, "Отозвать"))));
        assertThat(confirm.reply().text()).startsWith("Отозвать запрос: отмена занятия ");
        assertThat(done(mine.next(user, confirm.state(), new ChatInput.Choice(ChatKit.NO))).reply().text())
                .isEqualTo("Хорошо, запрос остаётся.");
        ChatStep.Done withdrawn = done(mine.next(user, confirm.state(), new ChatInput.Choice(ChatKit.YES)));
        assertThat(withdrawn.reply().text()).isEqualTo("Запрос отозван.");
        assertThat(withdrawn.audit()).isEqualTo("request-withdrawn " + pending.id());
        assertThat(done(mine.next(user, confirm.state(), new ChatInput.Choice(ChatKit.YES))).reply().text())
                .startsWith("Этот запрос уже нельзя отозвать");
        assertThat(done(mine.start(user)).reply().text()).contains("— отозван");
    }

    @Test
    void aLessonCancelledMeanwhileCannotBeChosen() {
        UUID ilya = directory.addStudent("Илья");
        ChatUser user = new ChatUser(ilya, Role.STUDENT);
        UUID lesson = plan(ilya, null, Slots.next(clock), null);
        ChatAction cancel = action(actions, "schedule.cancel");
        ChatStep.Ask which = ask(cancel.start(user));
        ChatStep.Ask comment = ask(cancel.next(user, which.state(), new ChatInput.Choice("lesson:" + lesson)));

        schedule.cancel(lesson, new CancelLesson(null, false, false));

        assertThat(done(cancel.next(user, comment.state(), new ChatInput.Choice("skip"))).reply().text())
                .startsWith("Нет занятий, которые можно отменить");
        assertThat(done(cancel.next(user, which.state(), new ChatInput.Choice("lesson:" + lesson))).reply().text())
                .startsWith("Нет занятий, которые можно отменить");
    }

    @Test
    void pagesThroughManyLessons() {
        UUID kira = directory.addStudent("Кира");
        ChatUser user = new ChatUser(kira, Role.STUDENT);
        for (int i = 0; i < ChatKit.PAGE_SIZE + 1; i++) {
            plan(kira, null, Slots.next(clock), null);
        }
        ChatAction cancel = action(actions, "schedule.cancel");

        ChatStep.Ask first = ask(cancel.start(user));
        assertThat(labels(first)).hasSize(ChatKit.PAGE_SIZE + 1).last().isEqualTo("Ещё ›");
        ChatStep.Ask second = ask(cancel.next(user, first.state(), new ChatInput.Choice(value(first, "Ещё"))));
        assertThat(labels(second)).containsExactly(labels(second).getFirst(), "‹ Назад");
        assertThat(action(actions, "schedule.lessons").start(user).reply().text()).doesNotContain("…и ещё");
    }

    private UUID plan(UUID studentId, UUID groupId, Instant startsAt, String topic) {
        return schedule.plan(new PlanLesson(studentId, groupId, startsAt, 60, topic, null, true)).id();
    }
}

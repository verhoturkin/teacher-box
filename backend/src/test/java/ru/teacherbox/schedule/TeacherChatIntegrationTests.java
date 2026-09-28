package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.testing.ChatSteps.action;
import static ru.teacherbox.testing.ChatSteps.ask;
import static ru.teacherbox.testing.ChatSteps.done;
import static ru.teacherbox.testing.ChatSteps.labels;
import static ru.teacherbox.testing.ChatSteps.rawLabels;
import static ru.teacherbox.testing.ChatSteps.value;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.api.LessonChangeRequested;
import ru.teacherbox.schedule.application.ChangeRequestService;
import ru.teacherbox.schedule.application.ScheduleQueries;
import ru.teacherbox.schedule.application.ScheduleService;
import ru.teacherbox.schedule.application.ScheduleService.PlanLesson;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.ParticipantView;
import ru.teacherbox.schedule.application.ScheduleViews.RequestView;
import ru.teacherbox.schedule.domain.Attendance;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.schedule.domain.RequestStatus;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatKit;
import ru.teacherbox.shared.chat.ChatOffer;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.security.Role;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.ChatSteps;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;

/** The teacher's schedule in the messenger bot: marking lessons and answering requests (ADR-0013). */
@ScheduleIntegrationTest
class TeacherChatIntegrationTests {

    private static final ZoneId MOSCOW = ZoneId.of("Europe/Moscow");
    private static final String ANSWERED = "На этот запрос уже ответили или его отозвали.";

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
    MutableClock clock;

    private ChatUser teacher() {
        return new ChatUser(directory.teacherId(), Role.TEACHER);
    }

    @Test
    void marksALessonOfToday() {
        UUID maria = directory.addStudent("Мария Сегодня");
        UUID lesson = plan(maria, null, startOfToday(), "Дроби");
        ChatAction today = action(actions, "schedule.today");
        assertThat(today.availableTo(teacher())).isTrue();
        assertThat(today.availableTo(new ChatUser(maria, Role.STUDENT))).isFalse();

        ChatStep.Ask list = ask(today.start(teacher()));
        assertThat(list.reply().text()).startsWith("Занятия сегодня:")
                .contains("Мария Сегодня — Дроби — запланировано", "Какое занятие отметить?");
        ChatStep.Ask how = ask(today.next(teacher(), list.state(), new ChatInput.Choice("lesson:" + lesson)));
        assertThat(how.reply().text()).endsWith("Как прошло занятие?");
        assertThat(labels(how)).containsExactly("Проведено", "Пропуск");
        assertThat(ask(today.next(teacher(), how.state(), new ChatInput.Text("хорошо"))).reply().text())
                .isEqualTo("Выберите: «Проведено» или «Пропуск».");

        ChatStep.Ask confirm = ask(today.next(teacher(), how.state(), new ChatInput.Choice("CONDUCTED")));
        assertThat(confirm.reply().text()).startsWith("Отметить занятие ").endsWith(" как проведённое?");
        assertThat(done(today.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.NO))).reply().text())
                .isEqualTo("Хорошо, не отмечаю.");
        ChatStep.Done marked = done(today.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.YES)));
        assertThat(marked.reply().text()).isEqualTo("Отмечено: проведено.");
        assertThat(marked.audit()).isEqualTo("lesson-marked " + lesson + " CONDUCTED");
        assertThat(queries.lesson(lesson).status()).isEqualTo(LessonStatus.CONDUCTED);

        assertThat(done(today.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.YES))).reply().text())
                .isEqualTo("Это занятие уже отмечено.");
        assertThat(today.next(teacher(), how.state(), new ChatInput.Choice("MISSED")).reply().text())
                .startsWith("Это занятие уже отмечено.");
        assertThat(today.next(teacher(), list.state(), new ChatInput.Choice("lesson:" + lesson)).reply().text())
                .startsWith("Это занятие уже отмечено или ещё не началось.");
        assertThat(today.next(teacher(), list.state(), new ChatInput.Choice("lesson:bad")).reply().text())
                .startsWith("Это занятие уже отмечено или ещё не началось.");
        assertThat(today.next(teacher(), ChatState.EMPTY, new ChatInput.Text("?")).reply().text())
                .startsWith("Занятия сегодня:");
    }

    @Test
    void marksTheAttendanceOfAGroup() {
        UUID anna = directory.addStudent("Анна Группа");
        UUID boris = directory.addStudent("Борис Группа");
        UUID vera = directory.addStudent("Вера Группа");
        UUID group = groups.addGroup("Посещаемость", anna, boris, vera);
        UUID lesson = plan(null, group, Slots.past(clock), null);
        ChatAction unmarked = action(actions, "schedule.unmarked");

        ChatStep.Ask list = ask(unmarked.start(teacher()));
        assertThat(list.reply().text()).startsWith("Прошедшие занятия без отметки:")
                .contains("группа «Посещаемость»");
        ChatStep.Ask who = ask(unmarked.next(teacher(), list.state(), new ChatInput.Choice("lesson:" + lesson)));
        assertThat(who.reply().text()).endsWith("Отметьте, кто был на занятии, и нажмите «Готово».");
        assertThat(rawLabels(who)).containsExactly("✅ Анна Группа", "✅ Борис Группа", "✅ Вера Группа", "✔️ Готово");

        ChatStep.Ask off = ask(unmarked.next(teacher(), who.state(), new ChatInput.Choice("toggle:" + vera)));
        assertThat(rawLabels(off)).contains("⬜ Вера Группа");
        ChatStep.Ask on = ask(unmarked.next(teacher(), off.state(), new ChatInput.Choice("toggle:" + vera)));
        assertThat(rawLabels(on)).contains("✅ Вера Группа");
        assertThat(rawLabels(unmarked.next(teacher(), off.state(), new ChatInput.Text("?")))).contains("⬜ Вера Группа");

        ChatStep.Ask confirm = ask(unmarked.next(teacher(), off.state(), new ChatInput.Choice(value(off, "Готово"))));
        assertThat(confirm.reply().text())
                .isEqualTo("Отметить посещаемость: были — Анна Группа, Борис Группа; не было — Вера Группа?");
        ChatStep.Done marked = done(unmarked.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.YES)));
        assertThat(marked.reply().text()).isEqualTo("Посещаемость отмечена.");
        LessonView view = queries.lesson(lesson);
        assertThat(view.status()).isEqualTo(LessonStatus.CONDUCTED);
        assertThat(view.participants()).extracting(ParticipantView::attendance)
                .containsExactly(Attendance.ATTENDED, Attendance.ATTENDED, Attendance.MISSED);
        assertThat(unmarked.next(teacher(), off.state(), new ChatInput.Choice("ready")).reply().text())
                .startsWith("Это занятие уже отмечено.");
    }

    @Test
    void nobodyCameToAGroupLesson() {
        UUID gleb = directory.addStudent("Глеб Никто");
        UUID group = groups.addGroup("Пустая", gleb);
        UUID lesson = plan(null, group, Slots.past(clock), null);
        ChatAction unmarked = action(actions, "schedule.unmarked");

        ChatStep.Ask who = ask(unmarked.next(teacher(), ChatState.EMPTY.withStep("lesson"),
                new ChatInput.Choice("lesson:" + lesson)));
        ChatStep.Ask off = ask(unmarked.next(teacher(), who.state(), new ChatInput.Choice("toggle:" + gleb)));
        ChatStep.Ask confirm = ask(unmarked.next(teacher(), off.state(), new ChatInput.Choice("ready")));
        assertThat(confirm.reply().text()).isEqualTo("Отметить посещаемость: были — никто; не было — Глеб Никто?");
        done(unmarked.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.YES)));
        assertThat(queries.lesson(lesson).status()).isEqualTo(LessonStatus.MISSED);
    }

    @Test
    void aBigGroupIsMarkedOnThePortal() {
        UUID[] members = new UUID[9];
        for (int i = 0; i < members.length; i++) {
            members[i] = directory.addStudent("Большая " + i);
        }
        UUID group = groups.addGroup("Большая", members);
        UUID lesson = plan(null, group, Slots.past(clock), null);

        assertThat(done(action(actions, "schedule.unmarked").next(teacher(), ChatState.EMPTY.withStep("lesson"),
                new ChatInput.Choice("lesson:" + lesson))).reply().text()).startsWith("В группе больше 8 учеников");
    }

    @Test
    void acceptsAndDeclinesRequests() {
        UUID dina = directory.addStudent("Дина Запрос");
        UUID moved = plan(dina, null, Slots.next(clock), null);
        UUID kept = plan(dina, null, Slots.next(clock), null);
        Instant proposed = Slots.next(clock);
        RequestView move = requests.request(dina, moved, ChangeKind.RESCHEDULE, proposed, "Можно позже?");
        RequestView cancel = requests.request(dina, kept, ChangeKind.CANCEL, null, null);
        ChatAction answer = action(actions, "schedule.answer");
        assertThat(answer.availableTo(new ChatUser(dina, Role.STUDENT))).isFalse();

        ChatStep.Ask list = ask(answer.start(teacher()));
        assertThat(list.reply().text()).startsWith("Запросы учеников:")
                .contains("Дина Запрос: перенести занятие ", " — «Можно позже?»", "Дина Запрос: отменить занятие ");
        ChatStep.Ask decide = ask(answer.next(teacher(), list.state(), new ChatInput.Choice("request:" + move.id())));
        assertThat(labels(decide)).containsExactly("Принять", "Отклонить");
        assertThat(labels(answer.next(teacher(), decide.state(), new ChatInput.Text("?")))).contains("Принять");
        ChatStep.Ask confirm = ask(answer.next(teacher(), decide.state(), new ChatInput.Choice("accept")));
        assertThat(confirm.reply().text()).startsWith("Перенести занятие (Дина Запрос) с ").contains(" на ");
        assertThat(done(answer.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.NO))).reply().text())
                .isEqualTo("Хорошо, запрос ждёт ответа.");
        ChatStep.Done accepted = done(answer.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.YES)));
        assertThat(accepted.reply().text()).isEqualTo("Занятие перенесено. Ученик получит уведомление.");
        assertThat(accepted.audit()).isEqualTo("request-approved " + move.id());
        assertThat(queries.lesson(moved).startsAt()).isEqualTo(proposed);
        assertThat(done(answer.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.YES))).reply().text())
                .isEqualTo(ANSWERED);

        ChatStep.Ask reason = ask(answer.next(teacher(), ChatState.of("request", cancel.id().toString())
                .withStep("decide"), new ChatInput.Choice("decline")));
        assertThat(labels(reason)).containsExactly("Без ответа");
        assertThat(ask(answer.next(teacher(), reason.state(), new ChatInput.Text(" "))).reply().text())
                .startsWith("Напишите ответ ученику");
        assertThat(ask(answer.next(teacher(), reason.state(), new ChatInput.Text("x".repeat(501)))).reply().text())
                .startsWith("Слишком длинно");
        ChatStep.Ask declineConfirm = ask(answer.next(teacher(), reason.state(), new ChatInput.Text("Давай в среду")));
        assertThat(declineConfirm.reply().text()).startsWith("Отклонить запрос: Дина Запрос: отменить занятие ")
                .endsWith("?\nОтвет: Давай в среду");
        assertThat(done(answer.next(teacher(), declineConfirm.state(), new ChatInput.Text("нет"))).reply().text())
                .isEqualTo("Хорошо, запрос ждёт ответа.");
        ChatStep.Done declined = done(answer.next(teacher(), declineConfirm.state(), new ChatInput.Choice(ChatKit.YES)));
        assertThat(declined.reply().text()).isEqualTo("Запрос отклонён. Ученик получит ответ.");
        RequestView answered = queries.studentRequests(dina).stream()
                .filter(request -> request.id().equals(cancel.id())).findFirst().orElseThrow();
        assertThat(answered.status()).isEqualTo(RequestStatus.DECLINED);
        assertThat(answered.answer()).isEqualTo("Давай в среду");
        assertThat(answer.next(teacher(), ChatState.EMPTY.withStep("list"), new ChatInput.Choice("request:bad"))
                .reply().text()).isNotBlank();
    }

    @Test
    void chargesALateCancellationFromTheNotification() {
        UUID egor = directory.addStudent("Егор Поздно");
        UUID lesson = plan(egor, null, clock.instant().truncatedTo(ChronoUnit.HOURS).plus(Duration.ofHours(3)), null);
        RequestView late = requests.request(egor, lesson, ChangeKind.CANCEL, null, "Заболел");
        ChatAction answer = action(actions, "schedule.answer");

        assertThat(answer.offer(teacher(), new ChatSubject("other", late.id()))).isEmpty();
        ChatOffer offer = answer.offer(teacher(), new ChatSubject(LessonChangeRequested.CHAT_SUBJECT, late.id()))
                .orElseThrow();
        assertThat(offer.rows().getFirst()).extracting(button -> ChatSteps.plain(button.label())).containsExactly("Принять", "Отклонить");

        ChatStep.Ask charge = ask(answer.next(teacher(), offer.state(), new ChatInput.Choice("accept")));
        assertThat(charge.reply().text()).startsWith("Отмена поздняя.");
        assertThat(ask(answer.next(teacher(), charge.state(), new ChatInput.Text("?"))).reply().text())
                .startsWith("Отмена поздняя.");
        ChatStep.Ask confirm = ask(answer.next(teacher(), charge.state(), new ChatInput.Choice("charge")));
        assertThat(confirm.reply().text()).startsWith("Отменить занятие (Егор Поздно) ")
                .endsWith(" и засчитать его как пропуск?");
        ChatStep.Done done = done(answer.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.YES)));
        assertThat(done.reply().text()).isEqualTo("Занятие отменено. Ученик получит уведомление.");
        assertThat(done.audit()).isEqualTo("request-approved " + late.id() + " charged");
        assertThat(answer.offer(teacher(), new ChatSubject(LessonChangeRequested.CHAT_SUBJECT, late.id()))).isEmpty();
    }

    @Test
    void excusesAStudentOfAGroupLateWithoutCharge() {
        UUID zoya = directory.addStudent("Зоя Группа");
        UUID group = groups.addGroup("Поздняя", zoya);
        UUID lesson = plan(null, group, clock.instant().truncatedTo(ChronoUnit.HOURS).plus(Duration.ofHours(5)), null);
        RequestView late = requests.request(zoya, lesson, ChangeKind.CANCEL, null, null);
        ChatAction answer = action(actions, "schedule.answer");
        ChatState decide = ChatState.of("request", late.id().toString()).withStep("decide");

        ChatStep.Ask charge = ask(answer.next(teacher(), decide, new ChatInput.Choice("accept")));
        ChatStep.Ask confirm = ask(answer.next(teacher(), charge.state(), new ChatInput.Choice("free")));
        assertThat(confirm.reply().text()).startsWith("Отметить, что Зоя Группа не придёт на занятие группы «Поздняя» ")
                .endsWith("?").doesNotContain("пропуск");
        assertThat(done(answer.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.YES))).reply().text())
                .isEqualTo("Отмечено, что ученик не придёт. Ученик получит уведомление.");
        assertThat(answer.next(teacher(), ChatState.EMPTY, new ChatInput.Text("?")).reply().text())
                .doesNotContain("Зоя Группа");
    }

    private Instant startOfToday() {
        return LocalDate.ofInstant(clock.instant(), MOSCOW).atStartOfDay(MOSCOW).toInstant();
    }

    private UUID plan(UUID studentId, UUID groupId, Instant startsAt, String topic) {
        return schedule.plan(new PlanLesson(studentId, groupId, startsAt, 60, topic, null, true)).id();
    }
}

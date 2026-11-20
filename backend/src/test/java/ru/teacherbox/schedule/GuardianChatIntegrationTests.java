package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.testing.ChatSteps.action;
import static ru.teacherbox.testing.ChatSteps.ask;
import static ru.teacherbox.testing.ChatSteps.done;
import static ru.teacherbox.testing.ChatSteps.labels;
import static ru.teacherbox.testing.ChatSteps.value;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.application.ChangeRequestService;
import ru.teacherbox.schedule.application.ScheduleQueries;
import ru.teacherbox.schedule.application.ScheduleService;
import ru.teacherbox.schedule.application.ScheduleService.PlanLesson;
import ru.teacherbox.schedule.application.ScheduleViews.RequestView;
import ru.teacherbox.schedule.domain.RequestStatus;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatKit;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.security.Role;
import ru.teacherbox.testing.FakeGuardians;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;

/** A guardian in the messenger bot (ADR-0069): the children's lessons, moving and cancelling on a child's behalf. */
@ScheduleIntegrationTest
class GuardianChatIntegrationTests {

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
    FakeGuardians guardians;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    MutableClock clock;

    @Test
    void theMenuOfAGuardianHasTheChildrensActionsOnly() {
        UUID child = directory.addStudent("Меню");
        ChatUser guardian = new ChatUser(guardians.addGuardian("Родитель меню", child), Role.GUARDIAN);
        ChatUser student = new ChatUser(child, Role.STUDENT);

        assertThat(actions.stream().filter(action -> action.availableTo(guardian)).map(ChatAction::id))
                .containsExactlyInAnyOrder("schedule.family", "schedule.move", "schedule.cancel");
        assertThat(action(actions, "schedule.family").availableTo(student)).isFalse();
        assertThat(action(actions, "schedule.family").title(Language.RU)).isEqualTo("Расписание детей");
        assertThat(action(actions, "schedule.family").title(Language.EN)).isEqualTo("Children's lessons");
    }

    @Test
    void showsTheUpcomingLessonsOfEveryChild() {
        UUID masha = directory.addStudent("Маша Семья");
        UUID petya = directory.addStudent("Петя Семья");
        UUID parent = guardians.addGuardian("Анна", masha, petya);
        ChatUser user = new ChatUser(parent, Role.GUARDIAN);
        ChatAction family = action(actions, "schedule.family");
        UUID own = plan(masha, null, Slots.next(clock), "Дроби");
        UUID group = groups.addGroup("Хор", masha);
        UUID together = plan(null, group, Slots.next(clock), null);
        requests.request(masha, own, ChangeKind.RESCHEDULE, Slots.next(clock), null);
        requests.request(masha, together, ChangeKind.CANCEL, null, null);

        String text = done(family.next(user, ChatState.EMPTY, new ChatInput.Text("?"))).reply().text();

        assertThat(text).startsWith("Маша Семья, ближайшие занятия:\n• ")
                .contains("— Дроби (запрос ждёт ответа)", "— группа «Хор» (не придёт)")
                .endsWith("\n\nПетя Семья: запланированных занятий нет.");
        assertThat(done(family.start(new ChatUser(parent, Role.GUARDIAN, Language.EN))).reply().text())
                .startsWith("Маша Семья's upcoming lessons:").contains("(awaiting the teacher's reply)",
                        "(not attending)", "Петя Семья has no upcoming lessons.");
        guardians.unlink(parent, masha);
        guardians.unlink(parent, petya);
        assertThat(done(family.start(user)).reply().text()).isEqualTo("Запланированных занятий пока нет.");
    }

    @Test
    void aGuardianOfTwoChildrenChoosesTheChildAndAsksToMoveTheLesson() {
        UUID vanya = directory.addStudent("Ваня Перенос");
        UUID sasha = directory.addStudent("Саша Перенос");
        UUID parent = guardians.addGuardian("Ирина", vanya, sasha);
        ChatUser user = new ChatUser(parent, Role.GUARDIAN);
        ChatAction move = action(actions, "schedule.move");
        Instant startsAt = Slots.next(clock);
        UUID lesson = plan(sasha, null, startsAt, null);

        ChatStep.Ask child = ask(move.start(user));
        assertThat(child.reply().text()).isEqualTo("Для кого? Выберите ребёнка.");
        assertThat(labels(child)).containsExactly("Ваня Перенос", "Саша Перенос");
        assertThat(ask(move.next(user, child.state(), new ChatInput.Text("Саша"))).reply().text())
                .as("a child is chosen by a button").isEqualTo("Для кого? Выберите ребёнка.");
        assertThat(done(move.next(user, child.state(), new ChatInput.Choice(value(child, "Ваня")))).reply().text())
                .startsWith("Ваня Перенос: Нет занятий, которые можно перенести");
        assertThat(ask(move.next(user, child.state(), new ChatInput.Choice("child:" + UUID.randomUUID()))).reply()
                .text()).as("not their child").isEqualTo("Для кого? Выберите ребёнка.");

        ChatStep.Ask which = ask(move.next(user, child.state(), new ChatInput.Choice(value(child, "Саша"))));
        assertThat(which.reply().text()).isEqualTo("Саша Перенос\nКакое занятие перенести?");
        assertThat(ask(move.next(user, which.state(), new ChatInput.Text("это"))).reply().text())
                .startsWith("Выберите занятие кнопкой.\nСаша Перенос");
        ChatStep.Ask day = ask(move.next(user, which.state(), new ChatInput.Choice(value(which, ""))));
        LocalDateTime newTime = LocalDateTime.ofInstant(Slots.next(clock), MOSCOW);
        ChatStep.Ask time = ask(move.next(user, day.state(), new ChatInput.Choice("date:" + newTime.toLocalDate())));
        ChatStep.Ask comment = ask(move.next(user, time.state(),
                new ChatInput.Text(newTime.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm")))));
        ChatStep.Ask confirm = ask(move.next(user, comment.state(), new ChatInput.Choice(value(comment, "Без комментария"))));
        assertThat(confirm.reply().text()).startsWith("Саша Перенос\nПопросить учителя перенести занятие ");

        ChatStep.Done sent = done(move.next(user, confirm.state(), new ChatInput.Choice(ChatKit.YES)));

        assertThat(sent.reply().text()).isEqualTo("Запрос отправлен учителю. Ответ придёт сюда.");
        RequestView request = queries.studentRequests(sasha).getFirst();
        assertThat(request.lessonId()).isEqualTo(lesson);
        assertThat(request.studentId()).isEqualTo(sasha);
        assertThat(request.guardianId()).isEqualTo(parent);
        assertThat(request.guardianName()).isEqualTo("Ирина");
        assertThat(request.proposedStartsAt()).isEqualTo(newTime.atZone(MOSCOW).toInstant());
        ChatStep.Ask teacherList = ask(action(actions, "schedule.answer")
                .start(new ChatUser(directory.teacherId(), Role.TEACHER)));
        assertThat(teacherList.reply().text()).contains("Саша Перенос: перенести занятие ",
                " — запрос от родителя (Ирина)");

        guardians.unlink(parent, sasha);
        assertThat(done(move.next(user, confirm.state(), new ChatInput.Choice(ChatKit.YES))).reply().text())
                .as("the child is no longer theirs: the dialog starts over with the only child left")
                .startsWith("Ваня Перенос: Нет занятий, которые можно перенести");
    }

    @Test
    void aGuardianOfOneChildSaysTheChildWillNotComeToAGroupLesson() {
        UUID lena = directory.addStudent("Лена Пропуск");
        UUID group = groups.addGroup("Английский пропуск", lena);
        UUID parent = guardians.addGuardian("Папа", lena);
        ChatUser user = new ChatUser(parent, Role.GUARDIAN);
        ChatAction cancel = action(actions, "schedule.cancel");
        UUID lesson = plan(null, group, Slots.next(clock), null);

        ChatStep.Ask which = ask(cancel.start(user));
        assertThat(which.reply().text()).as("one child: no question whose")
                .isEqualTo("Лена Пропуск\nКакое занятие отменить?");
        ChatStep.Ask comment = ask(cancel.next(user, which.state(), new ChatInput.Choice(value(which, ""))));
        ChatStep.Ask confirm = ask(cancel.next(user, comment.state(), new ChatInput.Text("Заболела")));
        assertThat(confirm.reply().text())
                .startsWith("Сообщить учителю, что Лена Пропуск не придёт на занятие группы «Английский пропуск» ")
                .contains("Комментарий: Заболела");

        ChatStep.Done sent = done(cancel.next(user, confirm.state(), new ChatInput.Choice(ChatKit.YES)));

        assertThat(sent.reply().text()).isEqualTo("Готово: учитель увидит, что Лена Пропуск не придёт.");
        RequestView request = queries.studentRequests(lena).getFirst();
        assertThat(request.lessonId()).isEqualTo(lesson);
        assertThat(request.status()).isEqualTo(RequestStatus.APPROVED);
        assertThat(request.guardianId()).isEqualTo(parent);
        ChatUser english = new ChatUser(parent, Role.GUARDIAN, Language.EN);
        assertThat(done(cancel.start(english)).reply().text()).startsWith("Лена Пропуск: No lessons are available");
    }

    @Test
    void aGuardianWithoutChildrenHasNothingToChange() {
        UUID parent = guardians.addGuardian("Без детей");
        assertThat(done(action(actions, "schedule.move").start(new ChatUser(parent, Role.GUARDIAN))).reply().text())
                .startsWith("Нет занятий, которые можно перенести");
        assertThat(done(action(actions, "schedule.move").next(new ChatUser(parent, Role.GUARDIAN),
                ChatState.of("child", UUID.randomUUID().toString()).withStep("lesson"), new ChatInput.Text("x")))
                .reply().text()).startsWith("Нет занятий");
    }

    private UUID plan(UUID studentId, UUID groupId, Instant startsAt, String title) {
        return schedule.plan(new PlanLesson(studentId, groupId, startsAt, 60, title, null, null, true)).id();
    }
}

package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.testing.ChatSteps.action;
import static ru.teacherbox.testing.ChatSteps.ask;
import static ru.teacherbox.testing.ChatSteps.done;
import static ru.teacherbox.testing.ChatSteps.labels;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.teacherbox.billing.application.BillingQueryService;
import ru.teacherbox.billing.application.BillingService;
import ru.teacherbox.billing.application.BillingViews.PaymentView;
import ru.teacherbox.billing.application.GroupPriceService;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatKit;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatText;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.security.Role;
import ru.teacherbox.testing.FakeStudentGroups;
import ru.teacherbox.testing.FakeUserDirectory;
import ru.teacherbox.testing.MutableClock;

/** The teacher records payments and lessons through the messenger bot (ADR-0013). */
@BillingIntegrationTest
class TeacherBillingChatIntegrationTests {

    @Autowired
    List<ChatAction> actions;

    @Autowired
    BillingService billing;

    @Autowired
    BillingQueryService queries;

    @Autowired
    GroupPriceService groupPrices;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeStudentGroups groups;

    @Autowired
    MutableClock clock;

    private ChatUser teacher() {
        return new ChatUser(directory.teacherId(), Role.TEACHER);
    }

    private LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), ZoneId.of("Europe/Moscow"));
    }

    @Test
    void recordsAPayment() {
        UUID maria = directory.addStudent("Мария Оплата");
        billing.openAccount(maria);
        billing.changeLessonPrice(maria, 150_000);
        ChatAction payment = action(actions, "billing.payment");
        assertThat(payment.availableTo(teacher())).isTrue();
        assertThat(payment.availableTo(new ChatUser(maria, Role.STUDENT))).isFalse();

        ChatStep.Ask who = ask(payment.start(teacher()));
        assertThat(who.reply().text()).startsWith("Кто оплатил?");
        ChatStep.Ask amount = ask(payment.next(teacher(), who.state(), new ChatInput.Text("Мария Оплата")));
        assertThat(amount.reply().text()).startsWith("Сколько оплатил(а) Мария Оплата?");
        assertThat(labels(amount)).containsExactly("1 занятие · 1 500 ₽", "4 занятия · 6 000 ₽", "8 занятий · 12 000 ₽");
        assertThat(ask(payment.next(teacher(), amount.state(), new ChatInput.Text("много"))).reply().text())
                .startsWith("Не понял сумму.");
        assertThat(ask(payment.next(teacher(), amount.state(), new ChatInput.Choice("amount:-5"))).reply().text())
                .startsWith("Не понял сумму.");

        ChatStep.Ask confirm = ask(payment.next(teacher(), amount.state(), new ChatInput.Choice("amount:600000")));
        assertThat(confirm.reply().text())
                .isEqualTo("Записать оплату: Мария Оплата, 6 000 ₽, " + ChatText.date(today()) + "?");
        assertThat(done(payment.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.NO))).reply().text())
                .isEqualTo("Хорошо, не записываю.");

        ChatStep.Done recorded = done(payment.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.YES)));
        assertThat(recorded.reply().text()).isEqualTo("Оплата записана. У ученика аванс 6 000 ₽.");
        PaymentView saved = queries.ledger(maria).payments().getFirst();
        assertThat(recorded.audit()).isEqualTo("payment " + saved.id());
        assertThat(saved.amount()).isEqualTo(600_000);
        assertThat(saved.paidOn()).isEqualTo(today());

        ChatStep.Ask typed = ask(payment.next(teacher(), amount.state(), new ChatInput.Text("1 500,50")));
        assertThat(typed.state().get("amount")).contains("150050");
        directory.setStatus(maria, StudentStatus.DEACTIVATED);
        assertThat(done(payment.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.YES))).reply().text())
                .isEqualTo("Этого ученика уже нет среди текущих.");
        directory.setStatus(maria, StudentStatus.ACTIVE);
        assertThat(payment.next(teacher(), ChatState.EMPTY, new ChatInput.Text("?")).reply().text())
                .startsWith("Кто оплатил?");
    }

    @Test
    void addsALessonOfAStudent() {
        UUID boris = directory.addStudent("Борис Занятие");
        billing.openAccount(boris);
        billing.changeLessonPrice(boris, 120_000);
        ChatAction lesson = action(actions, "billing.lesson");
        assertThat(lesson.availableTo(new ChatUser(boris, Role.STUDENT))).isFalse();

        ChatStep.Ask who = ask(lesson.start(teacher()));
        assertThat(who.reply().text()).startsWith("С кем было занятие?");
        ChatStep.Ask day = ask(lesson.next(teacher(), who.state(), new ChatInput.Choice("pick:s:" + boris)));
        assertThat(day.reply().text()).startsWith("Когда было занятие?");
        assertThat(labels(day)).hasSize(7).last().isEqualTo(ChatKit.dateLabel(today()));
        assertThat(ask(lesson.next(teacher(), day.state(), new ChatInput.Text("когда-то"))).reply().text())
                .startsWith("Не понял дату.");
        assertThat(ask(lesson.next(teacher(), day.state(), new ChatInput.Choice("date:" + today().plusDays(1))))
                .reply().text()).startsWith("Это день в будущем");

        ChatStep.Ask confirm = ask(lesson.next(teacher(), day.state(), new ChatInput.Text("вчера")));
        assertThat(confirm.reply().text()).isEqualTo("Добавить проведённое занятие: Борис Занятие, "
                + ChatText.date(today().minusDays(1)) + ", 1 200 ₽?");
        assertThat(done(lesson.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.NO))).reply().text())
                .isEqualTo("Хорошо, не добавляю.");
        ChatStep.Done recorded = done(lesson.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.YES)));
        assertThat(recorded.reply().text()).isEqualTo("Занятие добавлено в журнал. У ученика задолженность 1 200 ₽.");
        assertThat(recorded.audit()).startsWith("lesson-recorded ");
        assertThat(queries.ledger(boris).lessons()).singleElement()
                .satisfies(view -> assertThat(view.date()).isEqualTo(today().minusDays(1)));
    }

    @Test
    void addsALessonOfAGroupForEveryCurrentMember() {
        UUID anna = directory.addStudent("Анна Группа");
        UUID gleb = directory.addStudent("Глеб Группа");
        UUID gone = directory.addStudent("Ушёл Группа", StudentStatus.DEACTIVATED);
        for (UUID student : List.of(anna, gleb)) {
            billing.openAccount(student);
        }
        UUID group = groups.addGroup("Журнал", anna, gleb, gone);
        groupPrices.change(group, 80_000);
        UUID empty = groups.addGroup("Пустая", gone);
        groupPrices.open(empty);
        ChatAction lesson = action(actions, "billing.lesson");

        ChatStep.Ask who = ask(lesson.start(teacher()));
        assertThat(labels(lesson.next(teacher(), who.state(), new ChatInput.Text("Журнал")))).isNotEmpty();
        ChatStep.Ask day = ask(lesson.next(teacher(), who.state(), new ChatInput.Choice("pick:g:" + group)));
        ChatStep.Ask confirm = ask(lesson.next(teacher(), day.state(), new ChatInput.Choice("date:" + today())));
        assertThat(confirm.reply().text()).isEqualTo("Добавить проведённое занятие группы «Журнал» "
                + ChatText.date(today()) + ": 2 ученика по 800 ₽?");
        ChatStep.Done recorded = done(lesson.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.YES)));
        assertThat(recorded.reply().text()).isEqualTo("Занятие группы добавлено в журнал: 2 ученика.");
        assertThat(recorded.audit()).startsWith("lessons-recorded group " + group);
        assertThat(queries.ledger(anna).lessons()).singleElement()
                .satisfies(view -> assertThat(view.price()).isEqualTo(80_000));
        assertThat(queries.ledger(gleb).balance()).isEqualTo(-80_000);

        ChatStep.Ask emptyDay = ask(lesson.next(teacher(), who.state(), new ChatInput.Choice("pick:g:" + empty)));
        assertThat(done(lesson.next(teacher(), emptyDay.state(), new ChatInput.Choice("date:" + today())))
                .reply().text()).isEqualTo("В группе «Пустая» нет учеников.");
        groups.archive(group);
        assertThat(done(lesson.next(teacher(), confirm.state(), new ChatInput.Choice(ChatKit.YES))).reply().text())
                .isEqualTo("Этой группы уже нет среди текущих.");
        assertThat(done(lesson.next(teacher(), day.state(), new ChatInput.Choice("date:" + today()))).reply().text())
                .isEqualTo("Этой группы уже нет среди текущих.");
        assertThat(done(lesson.next(teacher(), ChatState.of("owner", "s:" + gone).withStep("date"),
                new ChatInput.Choice("date:" + today()))).reply().text()).isEqualTo("Этого ученика уже нет среди текущих.");
        assertThat(lesson.next(teacher(), ChatState.EMPTY, new ChatInput.Text("?")).reply().text())
                .startsWith("С кем было занятие?");
    }
}

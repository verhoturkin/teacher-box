package ru.teacherbox.billing;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.teacherbox.testing.ChatSteps.action;
import static ru.teacherbox.testing.ChatSteps.done;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import ru.teacherbox.billing.application.BillingService;
import ru.teacherbox.billing.application.BillingService.RecordLesson;
import ru.teacherbox.billing.application.BillingService.RecordPayment;
import ru.teacherbox.billing.domain.LessonStatus;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.security.Role;
import ru.teacherbox.testing.FakeGuardians;
import ru.teacherbox.testing.FakeUserDirectory;

/** A student's payments and a guardian's balances of the children in the messenger bot (ADR-0013, ADR-0069). */
@BillingIntegrationTest
class PaymentsChatIntegrationTests {

    @Autowired
    List<ChatAction> actions;

    @Autowired
    BillingService billing;

    @Autowired
    FakeUserDirectory directory;

    @Autowired
    FakeGuardians guardians;

    @Test
    void showsTheBalanceThePriceAndTheLatestMovements() {
        UUID student = directory.addStudent("Мария");
        billing.openAccount(student);
        billing.changeLessonPrice(student, 150_000);
        ChatUser user = new ChatUser(student, Role.STUDENT);
        ChatAction payments = action(actions, "billing.payments");
        assertThat(payments.availableTo(user)).isTrue();
        assertThat(payments.availableTo(new ChatUser(directory.teacherId(), Role.TEACHER))).isFalse();
        assertThat(done(payments.start(user)).reply().text())
                .isEqualTo("Баланс: 0 — долгов нет.\nЦена занятия: 1 500 ₽");

        billing.recordLesson(new RecordLesson(student, LocalDate.of(2026, 9, 1), null, null, null, LessonStatus.CONDUCTED));
        UUID mistake = billing.recordLesson(new RecordLesson(student, LocalDate.of(2026, 9, 3), null, null, null,
                LessonStatus.MISSED)).id();
        billing.cancelLesson(mistake, "Ошибка");
        assertThat(done(payments.start(user)).reply().text()).startsWith("Задолженность: 1 500 ₽");

        billing.recordPayment(new RecordPayment(student, 450_050, LocalDate.of(2026, 9, 2), null));
        String text = done(payments.next(user, ChatState.EMPTY, new ChatInput.Text("ещё"))).reply().text();
        assertThat(text).startsWith("Аванс: 3 000,50 ₽")
                .contains("Последние оплаты:\n• 02.09.2026 — 4 500,50 ₽", "Последние занятия:\n• 01.09.2026 — 1 500 ₽")
                .doesNotContain("03.09.2026");

        ChatUser english = new ChatUser(student, Role.STUDENT, Language.EN);
        assertThat(payments.title(Language.EN)).isEqualTo("Payments");
        assertThat(done(payments.start(english)).reply().text()).startsWith("Credit: ₽3,000.50\nLesson price: ₽1,500")
                .contains("Recent payments:\n• 02.09.2026 — ₽4,500.50");
    }

    @Test
    void aGuardianSeesEveryChildsBalanceUnderTheirName() {
        UUID kolya = directory.addStudent("Коля");
        UUID olya = directory.addStudent("Оля");
        billing.openAccount(kolya);
        billing.openAccount(olya);
        billing.changeLessonPrice(kolya, 100_000);
        billing.changeLessonPrice(olya, 120_000);
        billing.recordLesson(new RecordLesson(olya, LocalDate.of(2026, 9, 1), null, 120_000L, null,
                LessonStatus.CONDUCTED));
        UUID parent = guardians.addGuardian("Мама", kolya, olya);
        ChatUser user = new ChatUser(parent, Role.GUARDIAN);
        ChatAction balance = action(actions, "billing.family");
        assertThat(balance.availableTo(user)).isTrue();
        assertThat(balance.availableTo(new ChatUser(kolya, Role.STUDENT))).isFalse();
        assertThat(action(actions, "billing.payments").availableTo(user)).as("the child's own item").isFalse();
        assertThat(balance.title(Language.RU)).isEqualTo("Баланс");

        assertThat(done(balance.start(user)).reply().text()).isEqualTo("""
                Коля
                Баланс: 0 — долгов нет.
                Цена занятия: 1 000 ₽

                Оля
                Задолженность: 1 200 ₽
                Цена занятия: 1 200 ₽

                Последние занятия:
                • 01.09.2026 — 1 200 ₽""");
        assertThat(done(balance.next(new ChatUser(parent, Role.GUARDIAN, Language.EN), ChatState.EMPTY,
                new ChatInput.Text("?"))).reply().text()).startsWith("Коля\nBalance: 0");

        guardians.unlink(parent, kolya);
        guardians.unlink(parent, olya);
        assertThat(done(balance.start(user)).reply().text()).isEqualTo("Детей в портале пока нет.");
    }
}

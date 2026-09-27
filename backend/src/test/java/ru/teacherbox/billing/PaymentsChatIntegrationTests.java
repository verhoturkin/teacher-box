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
import ru.teacherbox.billing.domain.PaymentMethod;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.security.Role;
import ru.teacherbox.testing.FakeUserDirectory;

/** A student's payments in the messenger bot (ADR-0013). */
@BillingIntegrationTest
class PaymentsChatIntegrationTests {

    @Autowired
    List<ChatAction> actions;

    @Autowired
    BillingService billing;

    @Autowired
    FakeUserDirectory directory;

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

        billing.recordPayment(new RecordPayment(student, 450_050, LocalDate.of(2026, 9, 2), PaymentMethod.CARD, null));
        String text = done(payments.next(user, ChatState.EMPTY, new ChatInput.Text("ещё"))).reply().text();
        assertThat(text).startsWith("Аванс: 3 000,50 ₽")
                .contains("Последние оплаты:\n• 02.09.2026 — 4 500,50 ₽", "Последние занятия:\n• 01.09.2026 — 1 500 ₽")
                .doesNotContain("03.09.2026");
    }
}

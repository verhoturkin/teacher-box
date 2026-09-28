package ru.teacherbox.billing.chat;

import java.util.Currency;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import ru.teacherbox.billing.application.BillingService;
import ru.teacherbox.billing.application.BillingService.RecordPayment;
import ru.teacherbox.billing.application.BillingViews.PaymentView;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatButton;
import ru.teacherbox.shared.chat.ChatIcons;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatKit;
import ru.teacherbox.shared.chat.ChatPicker;
import ru.teacherbox.shared.chat.ChatReply;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatText;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.error.DomainException;

/** The teacher records a payment: student → amount (1, 4 or 8 lessons, or typed) → confirmation. */
@Component
class RecordPaymentChatAction implements ChatAction {

    static final String PROMPT = "Кто оплатил?";
    static final String AMOUNT = "amount:";
    static final List<Integer> LESSONS = List.of(1, 4, 8);

    private final TeacherBilling billing;
    private final BillingService service;

    RecordPaymentChatAction(TeacherBilling billing, BillingService service) {
        this.billing = billing;
        this.service = service;
    }

    @Override
    public String id() {
        return "billing.payment";
    }

    @Override
    public String title() {
        return "Записать оплату";
    }

    @Override
    public String icon() {
        return ChatIcons.RECORD_PAYMENT;
    }

    @Override
    public int order() {
        return 40;
    }

    @Override
    public boolean availableTo(ChatUser user) {
        return user.isTeacher();
    }

    @Override
    public ChatStep start(ChatUser user) {
        List<ChatPicker.Option> students = billing.students();
        if (students.isEmpty()) {
            return ChatStep.done("Учеников пока нет.");
        }
        return ChatStep.ask(ChatPicker.show(PROMPT, students), ChatState.EMPTY.withStep("student"));
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        String step = state.step();
        if (step == null) {
            return start(user);
        }
        if (step.equals("student")) {
            return switch (ChatPicker.handle(PROMPT, billing.students(), state, input)) {
                case ChatPicker.Picked picked -> askAmount(UUID.fromString(picked.id().substring(TeacherBilling.STUDENT.length())),
                        picked.state(), null);
                case ChatPicker.Shown shown -> ChatStep.ask(shown.reply(), shown.state());
            };
        }
        Optional<StudentSummary> student = state.id("student").flatMap(billing::student);
        if (student.isEmpty()) {
            return ChatStep.done("Этого ученика уже нет среди текущих.");
        }
        return switch (step) {
            case "amount" -> amount(student.get(), state, input);
            case "confirm" -> confirm(student.get(), state, input);
            default -> start(user);
        };
    }

    private ChatStep askAmount(UUID studentId, ChatState state, @Nullable String prefix) {
        Optional<StudentSummary> student = billing.student(studentId);
        if (student.isEmpty()) {
            return ChatStep.done("Этого ученика уже нет среди текущих.");
        }
        long price = billing.studentPrice(studentId);
        Currency currency = Currency.getInstance(billing.currency(studentId));
        String question = "Сколько оплатил(а) " + student.get().displayName()
                + "? Выберите или напишите сумму, например 3000.";
        ChatReply reply = ChatReply.of(prefix == null ? question : prefix + "\n" + question);
        if (price > 0) {
            for (int lessons : LESSONS) {
                reply = reply.row(ChatButton.choice(lessons(lessons) + " · " + TeacherBilling.money(price * lessons, currency),
                        AMOUNT + price * lessons));
            }
        }
        return ChatStep.ask(reply, state.with("student", studentId.toString()).withStep("amount"));
    }

    private ChatStep amount(StudentSummary student, ChatState state, ChatInput input) {
        Optional<Long> amount = ChatKit.choice(input, AMOUNT).flatMap(RecordPaymentChatAction::number)
                .or(() -> ChatKit.text(input).flatMap(ChatKit::amount));
        if (amount.isEmpty()) {
            return askAmount(student.id(), state, "Не понял сумму.");
        }
        Currency currency = Currency.getInstance(billing.currency(student.id()));
        String question = "Записать оплату: " + student.displayName() + ", "
                + TeacherBilling.money(amount.get(), currency) + ", " + ChatText.date(billing.today()) + "?";
        return ChatKit.confirm(question, state.with("amount", amount.get().toString()).withStep("confirm"));
    }

    private ChatStep confirm(StudentSummary student, ChatState state, ChatInput input) {
        if (!ChatKit.confirmed(input)) {
            return ChatStep.done("Хорошо, не записываю.");
        }
        PaymentView payment;
        try {
            payment = service.recordPayment(new RecordPayment(student.id(), Long.parseLong(state.get("amount").orElseThrow()),
                    billing.today(), null));
        } catch (DomainException e) {
            return ChatStep.done("Не получилось записать оплату. Запишите её на портале.");
        }
        return ChatStep.changed(ChatReply.of("Оплата записана. У ученика " + billing.balance(student.id()) + "."),
                "payment " + payment.id());
    }

    private static String lessons(int count) {
        return count == 1 ? "1 занятие" : count < 5 ? count + " занятия" : count + " занятий";
    }

    private static Optional<Long> number(String text) {
        try {
            long value = Long.parseLong(text);
            return value > 0 ? Optional.of(value) : Optional.empty();
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}

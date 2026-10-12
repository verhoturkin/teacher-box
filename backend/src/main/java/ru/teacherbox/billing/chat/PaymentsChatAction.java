package ru.teacherbox.billing.chat;

import java.util.Comparator;
import java.util.Currency;
import java.util.List;
import org.springframework.stereotype.Component;
import ru.teacherbox.billing.application.BillingQueryService;
import ru.teacherbox.billing.application.BillingViews.LessonView;
import ru.teacherbox.billing.application.BillingViews.PaymentView;
import ru.teacherbox.billing.application.BillingViews.StudentLedger;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatIcons;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatText;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.money.Money;
import ru.teacherbox.shared.money.MoneyFormat;

/** A student: the balance, the lesson price, the latest payments and charged lessons. */
@Component
class PaymentsChatAction implements ChatAction {

    static final int SHOWN = 5;

    private final BillingQueryService queries;

    PaymentsChatAction(BillingQueryService queries) {
        this.queries = queries;
    }

    @Override
    public String id() {
        return "billing.payments";
    }

    @Override
    public String title(Language language) {
        return BillingChatTexts.of(language).payments();
    }

    @Override
    public String icon() {
        return ChatIcons.PAYMENTS;
    }

    @Override
    public int order() {
        return 50;
    }

    @Override
    public boolean availableTo(ChatUser user) {
        return user.isStudent();
    }

    @Override
    public ChatStep start(ChatUser user) {
        StudentLedger ledger = queries.ledger(user.id());
        Currency currency = Currency.getInstance(ledger.currency());
        Language language = user.language();
        BillingChatTexts t = BillingChatTexts.of(language);
        StringBuilder text = new StringBuilder();
        long balance = ledger.balance();
        if (balance < 0) {
            text.append(t.debtLine(money(-balance, currency, language)));
        } else if (balance > 0) {
            text.append(t.creditLine(money(balance, currency, language)));
        } else {
            text.append(t.zeroLine());
        }
        text.append("\n").append(t.lessonPrice(money(ledger.lessonPrice(), currency, language)));
        List<PaymentView> payments = ledger.payments().stream()
                .filter(payment -> payment.voidedAt() == null)
                .sorted(Comparator.comparing(PaymentView::paidOn).thenComparing(PaymentView::createdAt).reversed())
                .limit(SHOWN)
                .toList();
        if (!payments.isEmpty()) {
            text.append("\n\n").append(t.latestPayments());
            payments.forEach(payment -> text.append("\n• ").append(ChatText.date(payment.paidOn())).append(" — ")
                    .append(money(payment.amount(), currency, language)));
        }
        List<LessonView> charged = ledger.lessons().stream()
                .filter(lesson -> lesson.status().isCharged())
                .sorted(Comparator.comparing(LessonView::date).thenComparing(LessonView::createdAt).reversed())
                .limit(SHOWN)
                .toList();
        if (!charged.isEmpty()) {
            text.append("\n\n").append(t.latestLessons());
            charged.forEach(lesson -> text.append("\n• ").append(ChatText.date(lesson.date())).append(" — ")
                    .append(money(lesson.price(), currency, language)));
        }
        return ChatStep.done(text.toString());
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        return start(user);
    }

    private static String money(long amount, Currency currency, Language language) {
        return MoneyFormat.format(Money.of(amount, currency), language);
    }
}

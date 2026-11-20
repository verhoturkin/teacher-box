package ru.teacherbox.billing.chat;

import java.util.List;
import org.springframework.stereotype.Component;
import ru.teacherbox.billing.application.BillingQueryService;
import ru.teacherbox.identity.api.Guardians;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatIcons;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.i18n.Language;

/**
 * A guardian (ADR-0069): each child's balance, lesson price, latest payments and charged lessons, under the
 * child's name — whether or not the payments are hidden from the child.
 */
@Component
class FamilyBalanceChatAction implements ChatAction {

    private final BillingQueryService queries;
    private final Guardians guardians;

    FamilyBalanceChatAction(BillingQueryService queries, Guardians guardians) {
        this.queries = queries;
        this.guardians = guardians;
    }

    @Override
    public String id() {
        return "billing.family";
    }

    @Override
    public String title(Language language) {
        return BillingChatTexts.of(language).balance();
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
        return user.isGuardian();
    }

    @Override
    public ChatStep start(ChatUser user) {
        List<StudentSummary> children = guardians.childrenOf(user.id());
        if (children.isEmpty()) {
            return ChatStep.done(BillingChatTexts.of(user.language()).noChildren());
        }
        StringBuilder text = new StringBuilder();
        for (StudentSummary child : children) {
            if (!text.isEmpty()) {
                text.append("\n\n");
            }
            text.append(child.displayName()).append("\n")
                    .append(PaymentsChatAction.describe(queries.ledger(child.id()), user.language()));
        }
        return ChatStep.done(text.toString());
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        return start(user);
    }
}

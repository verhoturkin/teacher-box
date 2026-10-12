package ru.teacherbox.schedule.chat;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.application.ChangeRequestService;
import ru.teacherbox.schedule.application.ScheduleQueries;
import ru.teacherbox.schedule.application.ScheduleViews.RequestView;
import ru.teacherbox.schedule.domain.RequestStatus;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatButton;
import ru.teacherbox.shared.chat.ChatIcons;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatKit;
import ru.teacherbox.shared.chat.ChatReply;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatText;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.error.DomainException;
import ru.teacherbox.shared.i18n.Language;

/** A student: the latest requests with the teacher's answers; an unanswered one can be taken back. */
@Component
class MyRequestsChatAction implements ChatAction {

    static final int SHOWN = 8;
    static final int WITHDRAWABLE = 5;
    static final String WITHDRAW = "withdraw:";

    private final ScheduleQueries queries;
    private final ChangeRequestService requests;
    private final StudentLessons lessons;

    MyRequestsChatAction(ScheduleQueries queries, ChangeRequestService requests, StudentLessons lessons) {
        this.queries = queries;
        this.requests = requests;
        this.lessons = lessons;
    }

    @Override
    public String id() {
        return "schedule.requests";
    }

    @Override
    public String title(Language language) {
        return ScheduleChatTexts.of(language).myRequests();
    }

    @Override
    public String icon() {
        return ChatIcons.REQUESTS;
    }

    @Override
    public int order() {
        return 40;
    }

    @Override
    public boolean availableTo(ChatUser user) {
        return user.isStudent();
    }

    @Override
    public ChatStep start(ChatUser user) {
        Language language = user.language();
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        List<RequestView> latest = queries.studentRequests(user.id());
        if (latest.isEmpty()) {
            return ChatStep.done(t.noRequests());
        }
        StringBuilder text = new StringBuilder(t.yourRequests());
        latest.stream().limit(SHOWN).forEach(request -> {
            text.append("\n• ").append(describe(request, language)).append(" — ").append(t.requestStatus(request.status()));
            if (request.answer() != null) {
                text.append("\n  ").append(t.teacherAnswer(request.answer()));
            }
        });
        List<RequestView> pending = latest.stream()
                .filter(request -> request.status() == RequestStatus.PENDING)
                .limit(WITHDRAWABLE)
                .toList();
        if (pending.isEmpty()) {
            return ChatStep.done(text.toString());
        }
        ChatReply reply = ChatReply.of(text + "\n\n" + t.canWithdraw());
        for (RequestView request : pending) {
            reply = reply.row(ChatButton.choice(ChatIcons.with(ChatIcons.WITHDRAW,
                    t.withdraw(ChatText.shortDayTime(request.lessonStartsAt(), lessons.zone(), language))),
                    WITHDRAW + request.id()));
        }
        return ChatStep.ask(reply, ChatState.EMPTY.withStep("list"));
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        if (state.at("confirm")) {
            return withdraw(user, state, input);
        }
        Optional<RequestView> request = ChatKit.choice(input, WITHDRAW)
                .flatMap(id -> pending(user, id));
        if (request.isEmpty()) {
            return start(user);
        }
        return ChatKit.confirm(ScheduleChatTexts.of(user.language()).confirmWithdraw(
                describe(request.get(), user.language())),
                ChatState.of("request", request.get().id().toString()).withStep("confirm"), user.language());
    }

    private ChatStep withdraw(ChatUser user, ChatState state, ChatInput input) {
        ScheduleChatTexts t = ScheduleChatTexts.of(user.language());
        if (!ChatKit.confirmed(input)) {
            return ChatStep.done(t.requestStays());
        }
        Optional<UUID> id = state.id("request");
        if (id.isEmpty() || pending(user, id.get().toString()).isEmpty()) {
            return ChatStep.done(t.cannotWithdraw());
        }
        try {
            requests.withdraw(user.id(), id.get());
        } catch (DomainException e) {
            return ChatStep.done(t.cannotWithdraw());
        }
        return ChatStep.changed(ChatReply.of(t.withdrawn()), "request-withdrawn " + id.get());
    }

    private Optional<RequestView> pending(ChatUser user, String id) {
        return queries.studentRequests(user.id()).stream()
                .filter(request -> request.id().toString().equals(id) && request.status() == RequestStatus.PENDING)
                .findFirst();
    }

    private String describe(RequestView request, Language language) {
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        String when = ChatText.dayTime(request.lessonStartsAt(), lessons.zone(), language);
        if (request.kind() == ChangeKind.RESCHEDULE) {
            return t.myMove(when, request.proposedStartsAt() == null ? null
                    : ChatText.dayTime(request.proposedStartsAt(), lessons.zone(), language));
        }
        return request.groupId() != null ? t.myAbsence(when) : t.myCancel(when);
    }
}

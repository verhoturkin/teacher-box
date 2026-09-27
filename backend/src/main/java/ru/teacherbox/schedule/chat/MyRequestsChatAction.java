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
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatKit;
import ru.teacherbox.shared.chat.ChatReply;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatText;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.error.DomainException;

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
    public String title() {
        return "Мои запросы";
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
        List<RequestView> latest = queries.studentRequests(user.id());
        if (latest.isEmpty()) {
            return ChatStep.done("Запросов пока нет.");
        }
        StringBuilder text = new StringBuilder("Ваши запросы:");
        latest.stream().limit(SHOWN).forEach(request -> {
            text.append("\n• ").append(describe(request)).append(" — ").append(status(request.status()));
            if (request.answer() != null) {
                text.append("\n  Учитель: «").append(request.answer()).append('»');
            }
        });
        List<RequestView> pending = latest.stream()
                .filter(request -> request.status() == RequestStatus.PENDING)
                .limit(WITHDRAWABLE)
                .toList();
        if (pending.isEmpty()) {
            return ChatStep.done(text.toString());
        }
        ChatReply reply = ChatReply.of(text + "\n\nЗапрос без ответа можно отозвать.");
        for (RequestView request : pending) {
            reply = reply.row(ChatButton.choice("Отозвать: " + ChatText.shortDayTime(request.lessonStartsAt(),
                    lessons.zone()), WITHDRAW + request.id()));
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
        return ChatKit.confirm("Отозвать запрос: " + describe(request.get()) + "?",
                ChatState.of("request", request.get().id().toString()).withStep("confirm"));
    }

    private ChatStep withdraw(ChatUser user, ChatState state, ChatInput input) {
        if (!ChatKit.confirmed(input)) {
            return ChatStep.done("Хорошо, запрос остаётся.");
        }
        Optional<UUID> id = state.id("request");
        if (id.isEmpty() || pending(user, id.get().toString()).isEmpty()) {
            return ChatStep.done("Этот запрос уже нельзя отозвать: учитель ответил на него.");
        }
        try {
            requests.withdraw(user.id(), id.get());
        } catch (DomainException e) {
            return ChatStep.done("Этот запрос уже нельзя отозвать: учитель ответил на него.");
        }
        return ChatStep.changed(ChatReply.of("Запрос отозван."), "request-withdrawn " + id.get());
    }

    private Optional<RequestView> pending(ChatUser user, String id) {
        return queries.studentRequests(user.id()).stream()
                .filter(request -> request.id().toString().equals(id) && request.status() == RequestStatus.PENDING)
                .findFirst();
    }

    private String describe(RequestView request) {
        String when = ChatText.dayTime(request.lessonStartsAt(), lessons.zone());
        if (request.kind() == ChangeKind.RESCHEDULE) {
            return request.proposedStartsAt() == null
                    ? "перенос занятия " + when
                    : "перенос занятия " + when + " на " + ChatText.dayTime(request.proposedStartsAt(), lessons.zone());
        }
        return request.groupId() != null ? "не приду на занятие " + when : "отмена занятия " + when;
    }

    static String status(RequestStatus status) {
        return switch (status) {
            case PENDING -> "ждёт ответа";
            case APPROVED -> "принят";
            case DECLINED -> "отклонён";
            case WITHDRAWN -> "отозван";
            case OUTDATED -> "устарел";
        };
    }
}

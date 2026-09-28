package ru.teacherbox.schedule.chat;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.api.LessonChangeRequested;
import ru.teacherbox.schedule.application.ChangeRequestService;
import ru.teacherbox.schedule.application.ChangeRequestService.Approval;
import ru.teacherbox.schedule.application.ScheduleViews.RequestView;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatButton;
import ru.teacherbox.shared.chat.ChatIcons;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatKit;
import ru.teacherbox.shared.chat.ChatOffer;
import ru.teacherbox.shared.chat.ChatReply;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.shared.chat.ChatText;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.error.DomainException;

/**
 * The teacher answers the students' requests: accept (a late cancellation — charged or not) or
 * decline with an answer. The buttons also come under the notification about a request.
 */
@Component
class AnswerRequestsChatAction implements ChatAction {

    static final String REQUEST = "request:";
    static final String ACCEPT = "accept";
    static final String DECLINE = "decline";
    static final String CHARGE = "charge";
    static final String FREE = "free";
    static final String SKIP = "skip";
    static final int MAX_ANSWER = 500;
    static final String ANSWERED = "На этот запрос уже ответили или его отозвали.";

    private final TeacherLessons lessons;
    private final ChangeRequestService requests;

    AnswerRequestsChatAction(TeacherLessons lessons, ChangeRequestService requests) {
        this.lessons = lessons;
        this.requests = requests;
    }

    @Override
    public String id() {
        return "schedule.answer";
    }

    @Override
    public String title() {
        return "Запросы";
    }

    @Override
    public String icon() {
        return ChatIcons.REQUESTS;
    }

    @Override
    public int order() {
        return 30;
    }

    @Override
    public boolean availableTo(ChatUser user) {
        return user.isTeacher();
    }

    @Override
    public Optional<ChatOffer> offer(ChatUser user, ChatSubject subject) {
        if (!LessonChangeRequested.CHAT_SUBJECT.equals(subject.type())
                || lessons.pendingRequest(subject.id()).isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new ChatOffer(List.of(decisionButtons()),
                ChatState.of("request", subject.id().toString()).withStep("decide")));
    }

    @Override
    public ChatStep start(ChatUser user) {
        return list(0);
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        String step = state.step();
        if (step == null) {
            return start(user);
        }
        if (step.equals("list")) {
            Optional<Integer> page = ChatKit.page(input);
            if (page.isPresent()) {
                return list(page.get());
            }
            return ChatKit.choice(input, REQUEST)
                    .flatMap(this::pending)
                    .map(request -> ChatStep.ask(ChatReply.of(describe(request)).row(decisionButtons().toArray(ChatButton[]::new)),
                            ChatState.of("request", request.id().toString()).withStep("decide")))
                    .orElseGet(() -> list(0));
        }
        Optional<RequestView> request = state.get("request").flatMap(this::pending);
        if (request.isEmpty()) {
            return ChatStep.done(ANSWERED);
        }
        return switch (step) {
            case "decide" -> decide(request.get(), state, input);
            case "charge" -> charge(request.get(), state, input);
            case "answer" -> answer(request.get(), state, input);
            case "confirm-accept" -> accept(request.get(), state, input);
            case "confirm-decline" -> decline(request.get(), state, input);
            default -> start(user);
        };
    }

    private ChatStep list(int page) {
        List<RequestView> pending = lessons.pendingRequests();
        if (pending.isEmpty()) {
            return ChatStep.done("Новых запросов нет.");
        }
        StringBuilder text = new StringBuilder("Запросы учеников:");
        pending.forEach(request -> text.append("\n• ").append(describe(request)));
        text.append("\n\nНа какой ответить?");
        return ChatStep.ask(ChatReply.of(text.toString()).rows(ChatKit.page(pending, page, this::label,
                request -> REQUEST + request.id())), ChatState.EMPTY.withStep("list"));
    }

    private ChatStep decide(RequestView request, ChatState state, ChatInput input) {
        if (ChatKit.choice(input, DECLINE).isPresent()) {
            return askAnswer(state);
        }
        if (ChatKit.choice(input, ACCEPT).isEmpty()) {
            return ChatStep.ask(ChatReply.of(describe(request)).row(decisionButtons().toArray(ChatButton[]::new)),
                    state);
        }
        if (request.kind() == ChangeKind.CANCEL && request.late()) {
            return ChatStep.ask(ChatReply.of("Отмена поздняя. Засчитать занятие как пропуск (оно будет оплачено)?")
                    .row(ChatButton.choice(ChatIcons.with(ChatIcons.CHARGE, "Засчитать"), CHARGE), ChatButton.choice(ChatIcons.with(ChatIcons.NO_CHARGE, "Не засчитывать"), FREE)),
                    state.withStep("charge"));
        }
        return ChatKit.confirm(acceptQuestion(request, false), state.withStep("confirm-accept"));
    }

    private ChatStep charge(RequestView request, ChatState state, ChatInput input) {
        boolean charge = ChatKit.choice(input, CHARGE).isPresent();
        if (!charge && ChatKit.choice(input, FREE).isEmpty()) {
            return decide(request, state, new ChatInput.Choice(ACCEPT));
        }
        return ChatKit.confirm(acceptQuestion(request, charge),
                state.with("charge", Boolean.toString(charge)).withStep("confirm-accept"));
    }

    private ChatStep askAnswer(ChatState state) {
        return ChatStep.ask(ChatReply.of("Напишите ответ ученику — например, предложите другое время. "
                + "Или нажмите «Без ответа».").row(ChatButton.choice(ChatIcons.with(ChatIcons.SKIP, "Без ответа"), SKIP)), state.withStep("answer"));
    }

    private ChatStep answer(RequestView request, ChatState state, ChatInput input) {
        ChatState next = state.without("answer");
        if (!(input instanceof ChatInput.Choice(String value) && SKIP.equals(value))) {
            Optional<String> text = ChatKit.text(input);
            if (text.isEmpty()) {
                return askAnswer(state);
            }
            if (text.get().length() > MAX_ANSWER) {
                return ChatStep.ask(ChatReply.of("Слишком длинно: не больше " + MAX_ANSWER + " символов.")
                        .row(ChatButton.choice(ChatIcons.with(ChatIcons.SKIP, "Без ответа"), SKIP)), state);
            }
            next = state.with("answer", text.get());
        }
        String question = "Отклонить запрос: " + describe(request) + "?"
                + next.get("answer").map(answer -> "\nОтвет: " + answer).orElse("");
        return ChatKit.confirm(question, next.withStep("confirm-decline"));
    }

    private ChatStep accept(RequestView request, ChatState state, ChatInput input) {
        if (!ChatKit.confirmed(input)) {
            return ChatStep.done("Хорошо, запрос ждёт ответа.");
        }
        boolean charge = state.get("charge").map(Boolean::parseBoolean).orElse(false);
        try {
            requests.approve(request.id(), new Approval(null, charge, null, false));
        } catch (DomainException e) {
            if (e.code().equals("schedule.slot-busy")) {
                return ChatStep.done("В это время у вас другое занятие или дела в календаре. Ответьте на портале.");
            }
            return ChatStep.done("Не получилось принять запрос: занятие изменилось. Ответьте на портале.");
        }
        String done = request.kind() == ChangeKind.RESCHEDULE ? "Занятие перенесено."
                : request.groupId() != null ? "Отмечено, что ученик не придёт." : "Занятие отменено.";
        return ChatStep.changed(ChatReply.of(done + " Ученик получит уведомление."),
                "request-approved " + request.id() + (charge ? " charged" : ""));
    }

    private ChatStep decline(RequestView request, ChatState state, ChatInput input) {
        if (!ChatKit.confirmed(input)) {
            return ChatStep.done("Хорошо, запрос ждёт ответа.");
        }
        try {
            requests.decline(request.id(), state.get("answer").orElse(null));
        } catch (DomainException e) {
            return ChatStep.done(ANSWERED);
        }
        return ChatStep.changed(ChatReply.of("Запрос отклонён. Ученик получит ответ."),
                "request-declined " + request.id());
    }

    private String acceptQuestion(RequestView request, boolean charge) {
        String student = request.studentName() == null ? "ученика" : request.studentName();
        String when = ChatText.dayTime(request.lessonStartsAt(), lessons.zone());
        if (request.kind() == ChangeKind.RESCHEDULE) {
            return "Перенести занятие (" + student + ") с " + when + " на "
                    + (request.proposedStartsAt() == null ? "предложенное время"
                            : ChatText.dayTime(request.proposedStartsAt(), lessons.zone())) + "?";
        }
        String question = request.groupId() != null
                ? "Отметить, что " + student + " не придёт на занятие группы «" + request.groupName() + "» " + when
                : "Отменить занятие (" + student + ") " + when;
        return question + (charge ? " и засчитать его как пропуск?" : "?");
    }

    private String describe(RequestView request) {
        String student = request.studentName() == null ? "Ученик" : request.studentName();
        String when = ChatText.dayTime(request.lessonStartsAt(), lessons.zone());
        StringBuilder text = new StringBuilder(student).append(": ");
        if (request.kind() == ChangeKind.RESCHEDULE) {
            text.append("перенести занятие ").append(when);
            if (request.proposedStartsAt() != null) {
                text.append(" на ").append(ChatText.dayTime(request.proposedStartsAt(), lessons.zone()));
            }
        } else if (request.groupId() != null) {
            text.append("не придёт на занятие группы «").append(request.groupName()).append("» ").append(when);
        } else {
            text.append("отменить занятие ").append(when);
        }
        if (request.late()) {
            text.append(" (поздно)");
        }
        if (request.comment() != null) {
            text.append(" — «").append(request.comment()).append('»');
        }
        return text.toString();
    }

    private String label(RequestView request) {
        return (request.studentName() == null ? "Ученик" : request.studentName()) + " · "
                + ChatText.shortDayTime(request.lessonStartsAt(), lessons.zone());
    }

    private Optional<RequestView> pending(String id) {
        try {
            return lessons.pendingRequest(UUID.fromString(id));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static List<ChatButton> decisionButtons() {
        return List.of(ChatButton.choice(ChatIcons.with(ChatIcons.ACCEPT, "Принять"), ACCEPT),
                ChatButton.choice(ChatIcons.with(ChatIcons.DECLINE, "Отклонить"), DECLINE));
    }
}

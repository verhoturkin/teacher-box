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
import ru.teacherbox.shared.i18n.Language;

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
    public String title(Language language) {
        return ScheduleChatTexts.of(language).requests();
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
        return Optional.of(new ChatOffer(List.of(decisionButtons(ScheduleChatTexts.of(user.language()))),
                ChatState.of("request", subject.id().toString()).withStep("decide")));
    }

    @Override
    public ChatStep start(ChatUser user) {
        return list(user.language(), 0);
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        String step = state.step();
        if (step == null) {
            return start(user);
        }
        Language language = user.language();
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        if (step.equals("list")) {
            Optional<Integer> page = ChatKit.page(input);
            if (page.isPresent()) {
                return list(language, page.get());
            }
            return ChatKit.choice(input, REQUEST)
                    .flatMap(this::pending)
                    .map(request -> ChatStep.ask(ChatReply.of(describe(request, language))
                                    .row(decisionButtons(t).toArray(ChatButton[]::new)),
                            ChatState.of("request", request.id().toString()).withStep("decide")))
                    .orElseGet(() -> list(language, 0));
        }
        Optional<RequestView> request = state.get("request").flatMap(this::pending);
        if (request.isEmpty()) {
            return ChatStep.done(t.answered());
        }
        return switch (step) {
            case "decide" -> decide(language, request.get(), state, input);
            case "charge" -> charge(language, request.get(), state, input);
            case "answer" -> answer(language, request.get(), state, input);
            case "confirm-accept" -> accept(language, request.get(), state, input);
            case "confirm-decline" -> decline(language, request.get(), state, input);
            default -> start(user);
        };
    }

    private ChatStep list(Language language, int page) {
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        List<RequestView> pending = lessons.pendingRequests();
        if (pending.isEmpty()) {
            return ChatStep.done(t.noNewRequests());
        }
        StringBuilder text = new StringBuilder(t.studentsRequests());
        pending.forEach(request -> text.append("\n• ").append(describe(request, language)));
        text.append("\n\n").append(t.whichToAnswer());
        return ChatStep.ask(ChatReply.of(text.toString()).rows(ChatKit.page(pending, page,
                request -> label(request, language), request -> REQUEST + request.id(), language)),
                ChatState.EMPTY.withStep("list"));
    }

    private ChatStep decide(Language language, RequestView request, ChatState state, ChatInput input) {
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        if (ChatKit.choice(input, DECLINE).isPresent()) {
            return askAnswer(t, state);
        }
        if (ChatKit.choice(input, ACCEPT).isEmpty()) {
            return ChatStep.ask(ChatReply.of(describe(request, language))
                    .row(decisionButtons(t).toArray(ChatButton[]::new)), state);
        }
        if (request.kind() == ChangeKind.CANCEL && request.late()) {
            return ChatStep.ask(ChatReply.of(t.lateCharge())
                    .row(ChatButton.choice(ChatIcons.with(ChatIcons.CHARGE, t.charge()), CHARGE),
                            ChatButton.choice(ChatIcons.with(ChatIcons.NO_CHARGE, t.free()), FREE)),
                    state.withStep("charge"));
        }
        return ChatKit.confirm(acceptQuestion(language, request, false), state.withStep("confirm-accept"), language);
    }

    private ChatStep charge(Language language, RequestView request, ChatState state, ChatInput input) {
        boolean charge = ChatKit.choice(input, CHARGE).isPresent();
        if (!charge && ChatKit.choice(input, FREE).isEmpty()) {
            return decide(language, request, state, new ChatInput.Choice(ACCEPT));
        }
        return ChatKit.confirm(acceptQuestion(language, request, charge),
                state.with("charge", Boolean.toString(charge)).withStep("confirm-accept"), language);
    }

    private ChatStep askAnswer(ScheduleChatTexts t, ChatState state) {
        return ChatStep.ask(ChatReply.of(t.askAnswer()).row(noAnswer(t)), state.withStep("answer"));
    }

    private ChatStep answer(Language language, RequestView request, ChatState state, ChatInput input) {
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        ChatState next = state.without("answer");
        if (!(input instanceof ChatInput.Choice(String value) && SKIP.equals(value))) {
            Optional<String> text = ChatKit.text(input);
            if (text.isEmpty()) {
                return askAnswer(t, state);
            }
            if (text.get().length() > MAX_ANSWER) {
                return ChatStep.ask(ChatReply.of(t.tooLong(MAX_ANSWER)).row(noAnswer(t)), state);
            }
            next = state.with("answer", text.get());
        }
        String question = t.confirmDecline(describe(request, language), next.get("answer").orElse(null));
        return ChatKit.confirm(question, next.withStep("confirm-decline"), language);
    }

    private ChatStep accept(Language language, RequestView request, ChatState state, ChatInput input) {
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        if (!ChatKit.confirmed(input)) {
            return ChatStep.done(t.requestWaits());
        }
        boolean charge = state.get("charge").map(Boolean::parseBoolean).orElse(false);
        try {
            requests.approve(request.id(), new Approval(null, charge, null, false));
        } catch (DomainException e) {
            if (e.code().equals("schedule.slot-busy")) {
                return ChatStep.done(t.youAreBusy());
            }
            return ChatStep.done(t.acceptFailed());
        }
        String done = request.kind() == ChangeKind.RESCHEDULE ? t.lessonMoved()
                : request.groupId() != null ? t.absenceMarked() : t.lessonCancelled();
        return ChatStep.changed(ChatReply.of(done), "request-approved " + request.id() + (charge ? " charged" : ""));
    }

    private ChatStep decline(Language language, RequestView request, ChatState state, ChatInput input) {
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        if (!ChatKit.confirmed(input)) {
            return ChatStep.done(t.requestWaits());
        }
        try {
            requests.decline(request.id(), state.get("answer").orElse(null));
        } catch (DomainException e) {
            return ChatStep.done(t.answered());
        }
        return ChatStep.changed(ChatReply.of(t.declined()), "request-declined " + request.id());
    }

    private String acceptQuestion(Language language, RequestView request, boolean charge) {
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        String student = request.studentName() == null ? t.theStudent() : request.studentName();
        String when = ChatText.dayTime(request.lessonStartsAt(), lessons.zone(), language);
        if (request.kind() == ChangeKind.RESCHEDULE) {
            return t.confirmMove(student, when, request.proposedStartsAt() == null ? null
                    : ChatText.dayTime(request.proposedStartsAt(), lessons.zone(), language));
        }
        return request.groupId() != null
                ? t.confirmAbsence(student, String.valueOf(request.groupName()), when, charge)
                : t.confirmCancel(student, when, charge);
    }

    private String describe(RequestView request, Language language) {
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        String student = request.studentName() == null ? t.unknownStudent() : request.studentName();
        String when = ChatText.dayTime(request.lessonStartsAt(), lessons.zone(), language);
        StringBuilder text = new StringBuilder();
        if (request.kind() == ChangeKind.RESCHEDULE) {
            text.append(t.asksToMove(student, when, request.proposedStartsAt() == null ? null
                    : ChatText.dayTime(request.proposedStartsAt(), lessons.zone(), language)));
        } else if (request.groupId() != null) {
            text.append(t.wontCome(student, String.valueOf(request.groupName()), when));
        } else {
            text.append(t.asksToCancel(student, when));
        }
        if (request.late()) {
            text.append(t.late());
        }
        if (request.comment() != null) {
            text.append(t.quoted(request.comment()));
        }
        return text.toString();
    }

    private String label(RequestView request, Language language) {
        return (request.studentName() == null ? ScheduleChatTexts.of(language).unknownStudent()
                : request.studentName()) + " · "
                + ChatText.shortDayTime(request.lessonStartsAt(), lessons.zone(), language);
    }

    private static ChatButton noAnswer(ScheduleChatTexts t) {
        return ChatButton.choice(ChatIcons.with(ChatIcons.SKIP, t.noAnswer()), SKIP);
    }

    private Optional<RequestView> pending(String id) {
        try {
            return lessons.pendingRequest(UUID.fromString(id));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static List<ChatButton> decisionButtons(ScheduleChatTexts t) {
        return List.of(ChatButton.choice(ChatIcons.with(ChatIcons.ACCEPT, t.accept()), ACCEPT),
                ChatButton.choice(ChatIcons.with(ChatIcons.DECLINE, t.decline()), DECLINE));
    }
}

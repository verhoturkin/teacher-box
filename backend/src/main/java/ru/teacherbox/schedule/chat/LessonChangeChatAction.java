package ru.teacherbox.schedule.chat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.application.ChangeRequestService;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.RequestView;
import ru.teacherbox.schedule.chat.StudentLessons.Subject;
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

/**
 * A student asks the teacher to cancel or to move a lesson: the lesson → (the new day and time) → a
 * comment → confirmation → the request. In a group lesson an early cancellation is «Не приду» and
 * is accepted at once (see {@link ChangeRequestService#request}). A guardian asks on a child's behalf
 * (ADR-0069): with several children the dialog first asks whose lesson it is, and every step checks that
 * the child is still theirs.
 */
abstract class LessonChangeChatAction implements ChatAction {

    static final String LESSON = "lesson:";
    static final String SKIP = "skip";
    static final int MAX_COMMENT = 500;
    static final int DATE_BUTTONS = 8;

    private final StudentLessons lessons;
    private final ChangeRequestService requests;
    private final ChangeKind kind;

    LessonChangeChatAction(StudentLessons lessons, ChangeRequestService requests, ChangeKind kind) {
        this.lessons = lessons;
        this.requests = requests;
        this.kind = kind;
    }

    @Override
    public boolean availableTo(ChatUser user) {
        return user.isStudent() || user.isGuardian();
    }

    @Override
    public ChatStep start(ChatUser user) {
        if (user.isGuardian()) {
            List<StudentSummary> children = lessons.children(user.id());
            if (children.size() != 1) {
                return children.isEmpty() ? nothingToChange(user.language())
                        : askChild(user.language(), children, 0);
            }
            return begin(user, ChatState.of("child", children.getFirst().id().toString()));
        }
        return begin(user, ChatState.EMPTY);
    }

    private ChatStep begin(ChatUser user, ChatState state) {
        Optional<Subject> subject = lessons.subject(user, state);
        if (subject.isEmpty()) {
            return start(user);
        }
        List<LessonView> changeable = lessons.changeable(subject.get().studentId());
        if (changeable.isEmpty()) {
            String nothing = ScheduleChatTexts.of(user.language()).nothingToChange(kind == ChangeKind.CANCEL);
            return ChatStep.done(subject.get().name() == null ? nothing : subject.get().name() + ": " + nothing);
        }
        return askLesson(user.language(), subject.get(), state, changeable, 0, null);
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        String step = state.step();
        if (step == null) {
            return start(user);
        }
        if (step.equals("child")) {
            return child(user, input);
        }
        Optional<Subject> subject = lessons.subject(user, state);
        if (subject.isEmpty()) {
            return start(user);
        }
        return switch (step) {
            case "lesson" -> lesson(user, subject.get(), state, input);
            case "date" -> date(user.language(), state, input);
            case "time" -> time(user.language(), state, input);
            case "comment" -> comment(user, subject.get(), state, input);
            case "confirm" -> confirm(user, subject.get(), state, input);
            default -> start(user);
        };
    }

    private ChatStep nothingToChange(Language language) {
        return ChatStep.done(ScheduleChatTexts.of(language).nothingToChange(kind == ChangeKind.CANCEL));
    }

    private ChatStep askChild(Language language, List<StudentSummary> children, int page) {
        return ChatStep.ask(ChatReply.of(ScheduleChatTexts.of(language).whichChild())
                        .rows(ChatKit.page(children, page, StudentSummary::displayName,
                                child -> StudentLessons.CHILD + child.id(), language)),
                ChatState.EMPTY.withStep("child"));
    }

    private ChatStep child(ChatUser user, ChatInput input) {
        Optional<Integer> page = ChatKit.page(input);
        if (page.isPresent()) {
            return askChild(user.language(), lessons.children(user.id()), page.get());
        }
        Optional<String> chosen = ChatKit.choice(input, StudentLessons.CHILD);
        if (chosen.isEmpty()) {
            return start(user);
        }
        ChatState state = ChatState.of("child", chosen.get());
        return lessons.subject(user, state).isPresent() ? begin(user, state) : start(user);
    }

    private ChatStep askLesson(Language language, Subject subject, ChatState state, List<LessonView> changeable,
            int page, @Nullable String prefix) {
        String question = ScheduleChatTexts.of(language).whichToChange(kind == ChangeKind.CANCEL);
        if (subject.name() != null) {
            question = subject.name() + "\n" + question;
        }
        return ChatStep.ask(ChatReply.of(prefix == null ? question : prefix + "\n" + question)
                        .rows(ChatKit.page(changeable, page, lesson -> lessons.label(lesson, language),
                                lesson -> LESSON + lesson.id(), language)),
                state.withStep("lesson"));
    }

    private ChatStep lesson(ChatUser user, Subject subject, ChatState state, ChatInput input) {
        Language language = user.language();
        List<LessonView> changeable = lessons.changeable(subject.studentId());
        Optional<Integer> page = ChatKit.page(input);
        if (page.isPresent()) {
            return askLesson(language, subject, state, changeable, page.get(), null);
        }
        Optional<LessonView> chosen = ChatKit.choice(input, LESSON)
                .flatMap(id -> changeable.stream().filter(lesson -> lesson.id().toString().equals(id)).findFirst());
        if (chosen.isEmpty()) {
            return changeable.isEmpty() ? start(user)
                    : askLesson(language, subject, state, changeable, 0,
                            ScheduleChatTexts.of(language).chooseByButton());
        }
        ChatState next = state.with("lesson", chosen.get().id().toString());
        return kind == ChangeKind.CANCEL ? askComment(language, next) : askDate(language, next, null);
    }
    private ChatStep askDate(Language language, ChatState state, @Nullable String prefix) {
        String question = ScheduleChatTexts.of(language).whichDay();
        return ChatStep.ask(ChatReply.of(prefix == null ? question : prefix + "\n" + question)
                .rows(ChatKit.dates(lessons.today(), DATE_BUTTONS, language)), state.withStep("date"));
    }

    private ChatStep date(Language language, ChatState state, ChatInput input) {
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        Optional<LocalDate> date = ChatKit.date(input, lessons.today())
                .filter(day -> !day.isBefore(lessons.today()));
        if (date.isEmpty()) {
            return askDate(language, state, t.dateNotUnderstood());
        }
        return ChatStep.ask(ChatReply.of(t.whatTime()), state.with("date", date.get().toString()).withStep("time"));
    }

    private ChatStep time(Language language, ChatState state, ChatInput input) {
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        Optional<LocalTime> time = ChatKit.text(input).flatMap(ChatKit::time);
        if (time.isEmpty()) {
            return ChatStep.ask(ChatReply.of(t.timeNotUnderstood()), state);
        }
        Instant proposed = LocalDate.parse(state.get("date").orElseThrow()).atTime(time.get())
                .atZone(lessons.zone()).toInstant();
        if (!proposed.isAfter(lessons.now())) {
            return askDate(language, state.without("date"), t.timePassed());
        }
        if (state.id("lesson").map(lesson -> !requests.isFreeFor(lesson, proposed)).orElse(false)) {
            return ChatStep.ask(ChatReply.of(t.teacherBusy()), state);
        }
        return askComment(language, state.with("proposed", proposed.toString()));
    }

    private ChatStep askComment(Language language, ChatState state) {
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        String question = kind == ChangeKind.CANCEL ? t.askReason() : t.askComment();
        return ChatStep.ask(ChatReply.of(question).row(noComment(t)), state.withStep("comment"));
    }

    private ChatStep comment(ChatUser user, Subject subject, ChatState state, ChatInput input) {
        Language language = user.language();
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        ChatState next = state;
        if (!(input instanceof ChatInput.Choice(String value) && SKIP.equals(value))) {
            Optional<String> text = ChatKit.text(input);
            if (text.isEmpty()) {
                return askComment(language, state);
            }
            if (text.get().length() > MAX_COMMENT) {
                return ChatStep.ask(ChatReply.of(t.tooLong(MAX_COMMENT)).row(noComment(t)), state);
            }
            next = state.with("comment", text.get());
        }
        Optional<LessonView> lesson = lesson(subject, next);
        if (lesson.isEmpty()) {
            return start(user);
        }
        return ChatKit.confirm(question(language, subject, lesson.get(), next), next.withStep("confirm"), language);
    }

    private String question(Language language, Subject subject, LessonView lesson, ChatState state) {
        ScheduleChatTexts t = ScheduleChatTexts.of(language);
        String when = ChatText.dayTime(lesson.startsAt(), lessons.zone(), language);
        StringBuilder text = new StringBuilder();
        String child = subject.name();
        if (child != null && !(kind == ChangeKind.CANCEL && lesson.groupName() != null)) {
            text.append(child).append("\n");
        }
        if (kind == ChangeKind.RESCHEDULE) {
            text.append(t.askToMove(when, ChatText.dayTime(Instant.parse(state.get("proposed").orElseThrow()),
                    lessons.zone(), language)));
        } else if (lesson.groupName() != null) {
            text.append(child == null ? t.tellAbsence(lesson.groupName(), when)
                    : t.tellChildAbsence(child, lesson.groupName(), when));
        } else {
            text.append(t.askToCancel(when));
        }
        if (kind == ChangeKind.CANCEL && lesson.startsAt().minus(lessons.lateCancellation()).isBefore(lessons.now())) {
            text.append("\n").append(t.lateWarning());
        }
        state.get("comment").ifPresent(comment -> text.append("\n").append(t.comment(comment)));
        return text.toString();
    }

    private ChatStep confirm(ChatUser user, Subject subject, ChatState state, ChatInput input) {
        ScheduleChatTexts t = ScheduleChatTexts.of(user.language());
        if (!ChatKit.confirmed(input)) {
            return ChatStep.done(t.notSending());
        }
        Optional<LessonView> lesson = lesson(subject, state);
        if (lesson.isEmpty()) {
            return ChatStep.done(t.cannotChange());
        }
        Instant proposed = state.get("proposed").map(Instant::parse).orElse(null);
        RequestView request;
        try {
            request = requests.request(subject.studentId(), user.id(), lesson.get().id(), kind, proposed,
                    state.get("comment").orElse(null));
        } catch (DomainException e) {
            if (e.code().equals("schedule.slot-busy")) {
                return ChatStep.done(t.slotBusy());
            }
            return ChatStep.done(t.requestFailed());
        }
        if (request.status() == RequestStatus.APPROVED) {
            String sent = subject.name() == null ? t.absenceSent() : t.childAbsenceSent(subject.name());
            return ChatStep.changed(ChatReply.of(sent), "change-request " + request.id());
        }
        return ChatStep.changed(ChatReply.of(t.requestSent()), "change-request " + request.id());
    }

    private static ChatButton noComment(ScheduleChatTexts t) {
        return ChatButton.choice(ChatIcons.with(ChatIcons.SKIP, t.noComment()), SKIP);
    }

    private Optional<LessonView> lesson(Subject subject, ChatState state) {
        Optional<UUID> id = state.id("lesson");
        return id.flatMap(lessonId -> lessons.changeable(subject.studentId()).stream()
                .filter(lesson -> lesson.id().equals(lessonId))
                .findFirst());
    }
}

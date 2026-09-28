package ru.teacherbox.schedule.chat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.application.ChangeRequestService;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
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

/**
 * A student asks the teacher to cancel or to move a lesson: the lesson → (the new day and time) → a
 * comment → confirmation → the request. In a group lesson an early cancellation is «Не приду» and
 * is accepted at once (see {@link ChangeRequestService#request}).
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
        return user.isStudent();
    }

    @Override
    public ChatStep start(ChatUser user) {
        List<LessonView> changeable = lessons.changeable(user.id());
        if (changeable.isEmpty()) {
            return ChatStep.done(kind == ChangeKind.CANCEL
                    ? "Нет занятий, которые можно отменить: запланированных занятий нет или по ним уже есть запросы."
                    : "Нет занятий, которые можно перенести: запланированных занятий нет или по ним уже есть запросы.");
        }
        return askLesson(changeable, 0, null);
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        String step = state.step();
        if (step == null) {
            return start(user);
        }
        return switch (step) {
            case "lesson" -> lesson(user, input);
            case "date" -> date(state, input);
            case "time" -> time(state, input);
            case "comment" -> comment(user, state, input);
            case "confirm" -> confirm(user, state, input);
            default -> start(user);
        };
    }

    private ChatStep askLesson(List<LessonView> changeable, int page, @Nullable String prefix) {
        String question = kind == ChangeKind.CANCEL ? "Какое занятие отменить?" : "Какое занятие перенести?";
        return ChatStep.ask(ChatReply.of(prefix == null ? question : prefix + "\n" + question)
                        .rows(ChatKit.page(changeable, page, lessons::label, lesson -> LESSON + lesson.id())),
                ChatState.EMPTY.withStep("lesson"));
    }

    private ChatStep lesson(ChatUser user, ChatInput input) {
        List<LessonView> changeable = lessons.changeable(user.id());
        Optional<Integer> page = ChatKit.page(input);
        if (page.isPresent()) {
            return askLesson(changeable, page.get(), null);
        }
        Optional<LessonView> chosen = ChatKit.choice(input, LESSON)
                .flatMap(id -> changeable.stream().filter(lesson -> lesson.id().toString().equals(id)).findFirst());
        if (chosen.isEmpty()) {
            return changeable.isEmpty() ? start(user) : askLesson(changeable, 0, "Выберите занятие кнопкой.");
        }
        ChatState state = ChatState.of("lesson", chosen.get().id().toString());
        return kind == ChangeKind.CANCEL ? askComment(state) : askDate(state, null);
    }

    private ChatStep askDate(ChatState state, @Nullable String prefix) {
        String question = "На какой день перенести? Выберите или напишите дату, например 05.10.";
        return ChatStep.ask(ChatReply.of(prefix == null ? question : prefix + "\n" + question)
                .rows(ChatKit.dates(lessons.today(), DATE_BUTTONS)), state.withStep("date"));
    }

    private ChatStep date(ChatState state, ChatInput input) {
        Optional<LocalDate> date = ChatKit.date(input, lessons.today())
                .filter(day -> !day.isBefore(lessons.today()));
        if (date.isEmpty()) {
            return askDate(state, "Не понял дату.");
        }
        return ChatStep.ask(ChatReply.of("Во сколько? Напишите время, например 18:30."),
                state.with("date", date.get().toString()).withStep("time"));
    }

    private ChatStep time(ChatState state, ChatInput input) {
        Optional<LocalTime> time = ChatKit.text(input).flatMap(ChatKit::time);
        if (time.isEmpty()) {
            return ChatStep.ask(ChatReply.of("Не понял время. Напишите его так: 18:30."), state);
        }
        Instant proposed = LocalDate.parse(state.get("date").orElseThrow()).atTime(time.get())
                .atZone(lessons.zone()).toInstant();
        if (!proposed.isAfter(lessons.now())) {
            return askDate(state.without("date"), "Это время уже прошло.");
        }
        if (state.id("lesson").map(lesson -> !requests.isFreeFor(lesson, proposed)).orElse(false)) {
            return ChatStep.ask(ChatReply.of("В это время учитель занят. Напишите другое время, например 18:30,"
                    + " или начните заново: /menu."), state);
        }
        return askComment(state.with("proposed", proposed.toString()));
    }

    private ChatStep askComment(ChatState state) {
        String question = kind == ChangeKind.CANCEL
                ? "Напишите причину — учитель её увидит. Или нажмите «Без комментария»."
                : "Напишите комментарий для учителя или нажмите «Без комментария».";
        return ChatStep.ask(ChatReply.of(question).row(ChatButton.choice("Без комментария", SKIP)),
                state.withStep("comment"));
    }

    private ChatStep comment(ChatUser user, ChatState state, ChatInput input) {
        ChatState next = state;
        if (!(input instanceof ChatInput.Choice(String value) && SKIP.equals(value))) {
            Optional<String> text = ChatKit.text(input);
            if (text.isEmpty()) {
                return askComment(state);
            }
            if (text.get().length() > MAX_COMMENT) {
                return ChatStep.ask(ChatReply.of("Слишком длинно: не больше " + MAX_COMMENT + " символов.")
                        .row(ChatButton.choice("Без комментария", SKIP)), state);
            }
            next = state.with("comment", text.get());
        }
        Optional<LessonView> lesson = lesson(user, next);
        if (lesson.isEmpty()) {
            return start(user);
        }
        return ChatKit.confirm(question(lesson.get(), next), next.withStep("confirm"));
    }

    private String question(LessonView lesson, ChatState state) {
        String when = ChatText.dayTime(lesson.startsAt(), lessons.zone());
        StringBuilder text = new StringBuilder();
        if (kind == ChangeKind.RESCHEDULE) {
            text.append("Попросить учителя перенести занятие ").append(when).append(" на ")
                    .append(ChatText.dayTime(Instant.parse(state.get("proposed").orElseThrow()), lessons.zone()))
                    .append('?');
        } else if (lesson.groupName() != null) {
            text.append("Сообщить учителю, что вы не придёте на занятие группы «").append(lesson.groupName())
                    .append("» ").append(when).append('?');
        } else {
            text.append("Попросить учителя отменить занятие ").append(when).append('?');
        }
        if (kind == ChangeKind.CANCEL && lesson.startsAt().minus(lessons.lateCancellation()).isBefore(lessons.now())) {
            text.append("\nДо занятия осталось мало времени: учитель может засчитать его как пропуск.");
        }
        state.get("comment").ifPresent(comment -> text.append("\nКомментарий: ").append(comment));
        return text.toString();
    }

    private ChatStep confirm(ChatUser user, ChatState state, ChatInput input) {
        if (!ChatKit.confirmed(input)) {
            return ChatStep.done("Хорошо, ничего не отправляю.");
        }
        Optional<LessonView> lesson = lesson(user, state);
        if (lesson.isEmpty()) {
            return ChatStep.done("Это занятие уже нельзя изменить: его перенесли, отменили или по нему уже есть запрос.");
        }
        Instant proposed = state.get("proposed").map(Instant::parse).orElse(null);
        RequestView request;
        try {
            request = requests.request(user.id(), lesson.get().id(), kind, proposed, state.get("comment").orElse(null));
        } catch (DomainException e) {
            if (e.code().equals("schedule.slot-busy")) {
                return ChatStep.done("Не получилось отправить запрос: в это время учитель уже занят.");
            }
            return ChatStep.done("Не получилось отправить запрос: занятие изменилось или по нему уже есть запрос.");
        }
        if (request.status() == RequestStatus.APPROVED) {
            return ChatStep.changed(ChatReply.of("Готово: учитель увидит, что вас не будет."),
                    "change-request " + request.id());
        }
        return ChatStep.changed(ChatReply.of("Запрос отправлен учителю. Ответ придёт сюда."),
                "change-request " + request.id());
    }

    private Optional<LessonView> lesson(ChatUser user, ChatState state) {
        Optional<UUID> id = state.id("lesson");
        return id.flatMap(lessonId -> lessons.changeable(user.id()).stream()
                .filter(lesson -> lesson.id().equals(lessonId))
                .findFirst());
    }
}

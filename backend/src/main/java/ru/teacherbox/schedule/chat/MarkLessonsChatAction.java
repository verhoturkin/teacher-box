package ru.teacherbox.schedule.chat;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.schedule.application.ScheduleService;
import ru.teacherbox.schedule.application.ScheduleViews.LessonView;
import ru.teacherbox.schedule.application.ScheduleViews.ParticipantView;
import ru.teacherbox.schedule.domain.Attendance;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatButton;
import ru.teacherbox.shared.chat.ChatIcons;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatKit;
import ru.teacherbox.shared.chat.ChatReply;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.error.DomainException;

/**
 * The teacher marks lessons: a lesson → «Проведено» or «Пропуск» (for a group — who came) →
 * confirmation.
 */
abstract class MarkLessonsChatAction implements ChatAction {

    static final String LESSON = "lesson:";
    static final String TOGGLE = "toggle:";
    static final String READY = "ready";
    /** Participants that fit on the buttons together with «Готово» and «Отмена». */
    static final int MAX_PARTICIPANTS = ChatKit.MAX_BUTTONS - 2;

    private final TeacherLessons lessons;
    private final ScheduleService schedule;

    MarkLessonsChatAction(TeacherLessons lessons, ScheduleService schedule) {
        this.lessons = lessons;
        this.schedule = schedule;
    }

    /** The lessons to show. */
    abstract List<LessonView> lessons();

    /** The heading of the list. */
    abstract String heading();

    /** The answer when there is nothing to show. */
    abstract String nothing();

    TeacherLessons teacherLessons() {
        return lessons;
    }

    @Override
    public boolean availableTo(ChatUser user) {
        return user.isTeacher();
    }

    @Override
    public ChatStep start(ChatUser user) {
        return list(0, null);
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        String step = state.step();
        if (step == null) {
            return start(user);
        }
        return switch (step) {
            case "lesson" -> choose(input);
            case "outcome" -> outcome(state, input);
            case "attendance" -> attendance(state, input);
            case "confirm" -> confirm(state, input);
            default -> start(user);
        };
    }

    private ChatStep list(int page, @Nullable String prefix) {
        List<LessonView> shown = lessons();
        if (shown.isEmpty()) {
            return ChatStep.done(prefix == null ? nothing() : prefix + "\n" + nothing());
        }
        StringBuilder text = new StringBuilder(prefix == null ? heading() : prefix + "\n" + heading());
        shown.forEach(lesson -> text.append("\n• ").append(lessons.describe(lesson)).append(" — ")
                .append(TeacherLessons.status(lesson.status())));
        List<LessonView> markable = shown.stream().filter(lessons::markable).toList();
        if (markable.isEmpty()) {
            return ChatStep.done(text.toString());
        }
        text.append("\n\nКакое занятие отметить?");
        return ChatStep.ask(ChatReply.of(text.toString())
                        .rows(ChatKit.page(markable, page, lessons::label, lesson -> LESSON + lesson.id())),
                ChatState.EMPTY.withStep("lesson"));
    }

    private ChatStep choose(ChatInput input) {
        Optional<Integer> page = ChatKit.page(input);
        if (page.isPresent()) {
            return list(page.get(), null);
        }
        Optional<LessonView> lesson = ChatKit.choice(input, LESSON).flatMap(this::markable);
        if (lesson.isEmpty()) {
            return list(0, "Это занятие уже отмечено или ещё не началось.");
        }
        ChatState state = ChatState.of("lesson", lesson.get().id().toString());
        if (lesson.get().groupId() == null) {
            return ChatStep.ask(ChatReply.of(lessons.describe(lesson.get()) + "\nКак прошло занятие?")
                    .row(ChatButton.choice(ChatIcons.with(ChatIcons.CONDUCTED, "Проведено"), "CONDUCTED"),
                            ChatButton.choice(ChatIcons.with(ChatIcons.MISSED, "Пропуск"), "MISSED")),
                    state.withStep("outcome"));
        }
        List<ParticipantView> participants = lesson.get().participants();
        if (participants.size() > MAX_PARTICIPANTS) {
            return ChatStep.done("В группе больше " + MAX_PARTICIPANTS
                    + " учеников — отметьте посещаемость на портале, в расписании.");
        }
        Set<String> present = participants.stream()
                .filter(participant -> participant.attendance() != Attendance.EXCUSED)
                .map(participant -> participant.studentId().toString())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        return askAttendance(lesson.get(), state.with("present", String.join(",", present)));
    }

    private ChatStep askAttendance(LessonView lesson, ChatState state) {
        Set<String> present = present(state);
        StringBuilder text = new StringBuilder(lessons.describe(lesson))
                .append("\nОтметьте, кто был на занятии, и нажмите «Готово».");
        List<List<ChatButton>> rows = new ArrayList<>();
        for (ParticipantView participant : lesson.participants()) {
            String name = participant.studentName() == null ? "Ученик" : participant.studentName();
            if (participant.attendance() == Attendance.EXCUSED) {
                text.append("\n").append(name).append(" предупредил(а), что не придёт.");
                continue;
            }
            boolean came = present.contains(participant.studentId().toString());
            rows.add(List.of(ChatButton.choice((came ? "✅ " : "⬜ ") + name, TOGGLE + participant.studentId())));
        }
        rows.add(List.of(ChatButton.choice(ChatIcons.with(ChatIcons.DONE, "Готово"), READY)));
        return ChatStep.ask(new ChatReply(text.toString(), rows), state.withStep("attendance"));
    }

    private ChatStep attendance(ChatState state, ChatInput input) {
        Optional<LessonView> lesson = state.id("lesson").flatMap(id -> markable(id.toString()));
        if (lesson.isEmpty()) {
            return list(0, "Это занятие уже отмечено.");
        }
        Optional<String> toggled = ChatKit.choice(input, TOGGLE);
        if (toggled.isPresent()) {
            Set<String> present = present(state);
            if (!present.remove(toggled.get())) {
                present.add(toggled.get());
            }
            return askAttendance(lesson.get(), state.with("present", String.join(",", present)));
        }
        if (!(input instanceof ChatInput.Choice(String value) && READY.equals(value))) {
            return askAttendance(lesson.get(), state);
        }
        Set<String> present = present(state);
        List<String> came = new ArrayList<>();
        List<String> missed = new ArrayList<>();
        for (ParticipantView participant : lesson.get().participants()) {
            String name = participant.studentName() == null ? "Ученик" : participant.studentName();
            if (participant.attendance() != Attendance.EXCUSED) {
                (present.contains(participant.studentId().toString()) ? came : missed).add(name);
            }
        }
        if (came.isEmpty() && missed.isEmpty()) {
            return ChatStep.done("Все ученики предупредили, что не придут: отмените занятие на портале.");
        }
        String question = "Отметить посещаемость: были — " + (came.isEmpty() ? "никто" : String.join(", ", came))
                + (missed.isEmpty() ? "" : "; не было — " + String.join(", ", missed)) + "?";
        return ChatKit.confirm(question, state.with("outcome", "ATTENDANCE").withStep("confirm"));
    }

    private ChatStep outcome(ChatState state, ChatInput input) {
        Optional<LessonView> lesson = state.id("lesson").flatMap(id -> markable(id.toString()));
        if (lesson.isEmpty()) {
            return list(0, "Это занятие уже отмечено.");
        }
        Optional<String> outcome = input instanceof ChatInput.Choice(String value)
                && (value.equals("CONDUCTED") || value.equals("MISSED")) ? Optional.of(value) : Optional.empty();
        if (outcome.isEmpty()) {
            return ChatStep.ask(ChatReply.of("Выберите: «Проведено» или «Пропуск».")
                    .row(ChatButton.choice(ChatIcons.with(ChatIcons.CONDUCTED, "Проведено"), "CONDUCTED"),
                            ChatButton.choice(ChatIcons.with(ChatIcons.MISSED, "Пропуск"), "MISSED")), state);
        }
        String what = outcome.get().equals("CONDUCTED") ? "проведённое" : "пропуск";
        return ChatKit.confirm("Отметить занятие " + lessons.describe(lesson.get()) + " как " + what + "?",
                state.with("outcome", outcome.get()).withStep("confirm"));
    }

    private ChatStep confirm(ChatState state, ChatInput input) {
        if (!ChatKit.confirmed(input)) {
            return ChatStep.done("Хорошо, не отмечаю.");
        }
        Optional<LessonView> lesson = state.id("lesson").flatMap(id -> markable(id.toString()));
        if (lesson.isEmpty()) {
            return ChatStep.done("Это занятие уже отмечено.");
        }
        String outcome = state.get("outcome").orElse("");
        try {
            if (outcome.equals("ATTENDANCE")) {
                Set<String> present = present(state);
                Map<UUID, Attendance> marks = new LinkedHashMap<>();
                for (ParticipantView participant : lesson.get().participants()) {
                    marks.put(participant.studentId(), participant.attendance() == Attendance.EXCUSED
                            ? Attendance.EXCUSED
                            : present.contains(participant.studentId().toString()) ? Attendance.ATTENDED
                                    : Attendance.MISSED);
                }
                schedule.markAttendance(lesson.get().id(), marks);
                return ChatStep.changed(ChatReply.of("Посещаемость отмечена."),
                        "attendance-marked " + lesson.get().id());
            }
            LessonStatus status = LessonStatus.valueOf(outcome);
            schedule.setOutcome(lesson.get().id(), status);
            return ChatStep.changed(ChatReply.of("Отмечено: " + TeacherLessons.status(status) + "."),
                    "lesson-marked " + lesson.get().id() + " " + status);
        } catch (DomainException | IllegalArgumentException e) {
            return ChatStep.done("Не получилось отметить: занятие изменилось. Откройте список ещё раз.");
        }
    }

    private Optional<LessonView> markable(String lessonId) {
        try {
            UUID id = UUID.fromString(lessonId);
            return lessons.lesson(id).filter(lessons::markable);
        } catch (DomainException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static Set<String> present(ChatState state) {
        return state.get("present")
                .filter(value -> !value.isEmpty())
                .map(value -> Arrays.stream(value.split(",")).collect(Collectors.toCollection(LinkedHashSet::new)))
                .orElseGet(LinkedHashSet::new);
    }
}

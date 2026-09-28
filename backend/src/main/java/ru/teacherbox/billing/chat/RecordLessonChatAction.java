package ru.teacherbox.billing.chat;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Currency;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import ru.teacherbox.billing.application.BillingService;
import ru.teacherbox.billing.application.BillingService.RecordLesson;
import ru.teacherbox.billing.domain.LessonStatus;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.shared.chat.ChatAction;
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

/**
 * The teacher adds a lesson that took place outside the schedule to the journal: a student or a
 * group (every current member at the group's price) → the day → confirmation.
 */
@Component
class RecordLessonChatAction implements ChatAction {

    static final String PROMPT = "С кем было занятие?";
    static final int DAYS_BACK = 7;

    private final TeacherBilling billing;
    private final BillingService service;

    RecordLessonChatAction(TeacherBilling billing, BillingService service) {
        this.billing = billing;
        this.service = service;
    }

    @Override
    public String id() {
        return "billing.lesson";
    }

    @Override
    public String title() {
        return "Добавить занятие";
    }

    @Override
    public String icon() {
        return ChatIcons.ADD_LESSON;
    }

    @Override
    public int order() {
        return 50;
    }

    @Override
    public boolean availableTo(ChatUser user) {
        return user.isTeacher();
    }

    @Override
    public ChatStep start(ChatUser user) {
        List<ChatPicker.Option> owners = billing.studentsAndGroups();
        if (owners.isEmpty()) {
            return ChatStep.done("Учеников пока нет.");
        }
        return ChatStep.ask(ChatPicker.show(PROMPT, owners), ChatState.EMPTY.withStep("owner"));
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        String step = state.step();
        if (step == null) {
            return start(user);
        }
        return switch (step) {
            case "owner" -> switch (ChatPicker.handle(PROMPT, billing.studentsAndGroups(), state, input)) {
                case ChatPicker.Picked picked -> askDate(picked.state().with("owner", picked.id()), null);
                case ChatPicker.Shown shown -> ChatStep.ask(shown.reply(), shown.state());
            };
            case "date" -> date(state, input);
            case "confirm" -> confirm(state, input);
            default -> start(user);
        };
    }

    private ChatStep askDate(ChatState state, @Nullable String prefix) {
        String question = "Когда было занятие? Выберите день или напишите дату, например 25.09.";
        return ChatStep.ask(ChatReply.of(prefix == null ? question : prefix + "\n" + question)
                .rows(ChatKit.dates(billing.today().minusDays(DAYS_BACK - 1), DAYS_BACK)), state.withStep("date"));
    }

    private ChatStep date(ChatState state, ChatInput input) {
        Optional<LocalDate> date = ChatKit.pastDate(input, billing.today());
        if (date.isEmpty() || date.get().isAfter(billing.today())) {
            return askDate(state, date.isEmpty() ? "Не понял дату." : "Это день в будущем — занятие ещё не прошло.");
        }
        String owner = state.get("owner").orElse("");
        String day = ChatText.date(date.get());
        ChatState next = state.with("date", date.get().toString()).withStep("confirm");
        if (owner.startsWith(TeacherBilling.GROUP)) {
            Optional<GroupSummary> group = group(owner);
            if (group.isEmpty()) {
                return ChatStep.done("Этой группы уже нет среди текущих.");
            }
            List<UUID> members = billing.members(group.get());
            if (members.isEmpty()) {
                return ChatStep.done("В группе «" + group.get().name() + "» нет учеников.");
            }
            String price = TeacherBilling.money(billing.groupPrice(group.get().id()),
                    Currency.getInstance(billing.currency(members.getFirst())));
            return ChatKit.confirm("Добавить проведённое занятие группы «" + group.get().name() + "» " + day + ": "
                    + members.size() + " " + students(members.size()) + " по " + price + "?", next);
        }
        Optional<StudentSummary> student = student(owner);
        if (student.isEmpty()) {
            return ChatStep.done("Этого ученика уже нет среди текущих.");
        }
        String price = TeacherBilling.money(billing.studentPrice(student.get().id()),
                Currency.getInstance(billing.currency(student.get().id())));
        return ChatKit.confirm("Добавить проведённое занятие: " + student.get().displayName() + ", " + day + ", "
                + price + "?", next);
    }

    private ChatStep confirm(ChatState state, ChatInput input) {
        if (!ChatKit.confirmed(input)) {
            return ChatStep.done("Хорошо, не добавляю.");
        }
        String owner = state.get("owner").orElse("");
        LocalDate date = LocalDate.parse(state.get("date").orElseThrow());
        List<UUID> recorded = new ArrayList<>();
        try {
            if (owner.startsWith(TeacherBilling.GROUP)) {
                Optional<GroupSummary> group = group(owner);
                if (group.isEmpty()) {
                    return ChatStep.done("Этой группы уже нет среди текущих.");
                }
                long price = billing.groupPrice(group.get().id());
                for (UUID member : billing.members(group.get())) {
                    recorded.add(service.recordLesson(new RecordLesson(member, date, null, price,
                            null, LessonStatus.CONDUCTED)).id());
                }
                return ChatStep.changed(ChatReply.of("Занятие группы добавлено в журнал: " + recorded.size() + " "
                        + students(recorded.size()) + "."), "lessons-recorded group " + group.get().id() + " "
                        + recorded);
            }
            Optional<StudentSummary> student = student(owner);
            if (student.isEmpty()) {
                return ChatStep.done("Этого ученика уже нет среди текущих.");
            }
            UUID lesson = service.recordLesson(new RecordLesson(student.get().id(), date, null, null, null,
                    LessonStatus.CONDUCTED)).id();
            return ChatStep.changed(ChatReply.of("Занятие добавлено в журнал. У ученика "
                    + billing.balance(student.get().id()) + "."), "lesson-recorded " + lesson);
        } catch (DomainException e) {
            return ChatStep.done("Не получилось добавить занятие. Добавьте его на портале.");
        }
    }

    private Optional<StudentSummary> student(String owner) {
        return parse(owner, TeacherBilling.STUDENT).flatMap(billing::student);
    }

    private Optional<GroupSummary> group(String owner) {
        return parse(owner, TeacherBilling.GROUP).flatMap(billing::group);
    }

    private static Optional<UUID> parse(String owner, String prefix) {
        if (!owner.startsWith(prefix)) {
            return Optional.empty();
        }
        try {
            return Optional.of(UUID.fromString(owner.substring(prefix.length())));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static String students(int count) {
        int lastTwo = count % 100;
        int last = count % 10;
        if (lastTwo >= 11 && lastTwo <= 14) {
            return "учеников";
        }
        return last == 1 ? "ученик" : last >= 2 && last <= 4 ? "ученика" : "учеников";
    }
}

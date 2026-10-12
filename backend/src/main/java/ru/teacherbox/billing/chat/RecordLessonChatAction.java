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
import ru.teacherbox.shared.i18n.Language;

/**
 * The teacher adds a lesson that took place outside the schedule to the journal: a student or a
 * group (every current member at the group's price) → the day → confirmation.
 */
@Component
class RecordLessonChatAction implements ChatAction {

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
    public String title(Language language) {
        return BillingChatTexts.of(language).addLesson();
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
        BillingChatTexts t = BillingChatTexts.of(user.language());
        List<ChatPicker.Option> owners = billing.studentsAndGroups(user.language());
        if (owners.isEmpty()) {
            return ChatStep.done(t.noStudents());
        }
        return ChatStep.ask(ChatPicker.show(t.withWhom(), owners, user.language()), ChatState.EMPTY.withStep("owner"));
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        String step = state.step();
        if (step == null) {
            return start(user);
        }
        Language language = user.language();
        return switch (step) {
            case "owner" -> switch (ChatPicker.handle(BillingChatTexts.of(language).withWhom(),
                    billing.studentsAndGroups(language), state, input, language)) {
                case ChatPicker.Picked picked -> askDate(language, picked.state().with("owner", picked.id()), null);
                case ChatPicker.Shown shown -> ChatStep.ask(shown.reply(), shown.state());
            };
            case "date" -> date(language, state, input);
            case "confirm" -> confirm(language, state, input);
            default -> start(user);
        };
    }

    private ChatStep askDate(Language language, ChatState state, @Nullable String prefix) {
        String question = BillingChatTexts.of(language).when();
        return ChatStep.ask(ChatReply.of(prefix == null ? question : prefix + "\n" + question)
                .rows(ChatKit.dates(billing.today().minusDays(DAYS_BACK - 1), DAYS_BACK, language)),
                state.withStep("date"));
    }

    private ChatStep date(Language language, ChatState state, ChatInput input) {
        BillingChatTexts t = BillingChatTexts.of(language);
        Optional<LocalDate> date = ChatKit.pastDate(input, billing.today());
        if (date.isEmpty() || date.get().isAfter(billing.today())) {
            return askDate(language, state, date.isEmpty() ? t.dateNotUnderstood() : t.future());
        }
        String owner = state.get("owner").orElse("");
        String day = ChatText.date(date.get());
        ChatState next = state.with("date", date.get().toString()).withStep("confirm");
        if (owner.startsWith(TeacherBilling.GROUP)) {
            Optional<GroupSummary> group = group(owner);
            if (group.isEmpty()) {
                return ChatStep.done(t.groupGone());
            }
            List<UUID> members = billing.members(group.get());
            if (members.isEmpty()) {
                return ChatStep.done(t.noMembers(group.get().name()));
            }
            String price = TeacherBilling.money(billing.groupPrice(group.get().id()),
                    Currency.getInstance(billing.currency(members.getFirst())), language);
            return ChatKit.confirm(t.confirmGroupLesson(group.get().name(), day, members.size(), price), next,
                    language);
        }
        Optional<StudentSummary> student = student(owner);
        if (student.isEmpty()) {
            return ChatStep.done(t.studentGone());
        }
        String price = TeacherBilling.money(billing.studentPrice(student.get().id()),
                Currency.getInstance(billing.currency(student.get().id())), language);
        return ChatKit.confirm(t.confirmLesson(student.get().displayName(), day, price), next, language);
    }

    private ChatStep confirm(Language language, ChatState state, ChatInput input) {
        BillingChatTexts t = BillingChatTexts.of(language);
        if (!ChatKit.confirmed(input)) {
            return ChatStep.done(t.notAdding());
        }
        String owner = state.get("owner").orElse("");
        LocalDate date = LocalDate.parse(state.get("date").orElseThrow());
        List<UUID> recorded = new ArrayList<>();
        try {
            if (owner.startsWith(TeacherBilling.GROUP)) {
                Optional<GroupSummary> group = group(owner);
                if (group.isEmpty()) {
                    return ChatStep.done(t.groupGone());
                }
                long price = billing.groupPrice(group.get().id());
                for (UUID member : billing.members(group.get())) {
                    recorded.add(service.recordLesson(new RecordLesson(member, date, null, price,
                            null, LessonStatus.CONDUCTED)).id());
                }
                return ChatStep.changed(ChatReply.of(t.groupLessonAdded(recorded.size())),
                        "lessons-recorded group " + group.get().id() + " " + recorded);
            }
            Optional<StudentSummary> student = student(owner);
            if (student.isEmpty()) {
                return ChatStep.done(t.studentGone());
            }
            UUID lesson = service.recordLesson(new RecordLesson(student.get().id(), date, null, null, null,
                    LessonStatus.CONDUCTED)).id();
            return ChatStep.changed(ChatReply.of(t.lessonAdded(billing.balance(student.get().id(), language))),
                    "lesson-recorded " + lesson);
        } catch (DomainException e) {
            return ChatStep.done(t.lessonFailed());
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
}

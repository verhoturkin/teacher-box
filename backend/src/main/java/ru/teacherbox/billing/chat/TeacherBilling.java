package ru.teacherbox.billing.chat;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.Currency;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;
import ru.teacherbox.billing.application.BillingQueryService;
import ru.teacherbox.billing.application.BillingViews.StudentLedger;
import ru.teacherbox.billing.application.GroupPriceService;
import ru.teacherbox.billing.application.GroupPriceService.GroupPriceView;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.chat.ChatPicker;
import ru.teacherbox.shared.money.Money;
import ru.teacherbox.shared.money.MoneyFormat;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Students, groups and prices for the teacher's billing actions of the bot. */
@Component
class TeacherBilling {

    static final String STUDENT = "s:";
    static final String GROUP = "g:";

    private final UserDirectory users;
    private final StudentGroups groups;
    private final BillingQueryService queries;
    private final GroupPriceService groupPrices;
    private final InstanceTimeZone zone;
    private final Clock clock;

    TeacherBilling(UserDirectory users, StudentGroups groups, BillingQueryService queries,
            GroupPriceService groupPrices, InstanceTimeZone zone, Clock clock) {
        this.users = users;
        this.groups = groups;
        this.queries = queries;
        this.groupPrices = groupPrices;
        this.zone = zone;
        this.clock = clock;
    }

    LocalDate today() {
        return zone.today(clock);
    }

    List<ChatPicker.Option> students() {
        return users.currentStudents().stream()
                .sorted(Comparator.comparing(StudentSummary::displayName, String.CASE_INSENSITIVE_ORDER))
                .map(student -> new ChatPicker.Option(STUDENT + student.id(), student.displayName()))
                .toList();
    }

    /** Current students and then the current groups. */
    List<ChatPicker.Option> studentsAndGroups() {
        List<UUID> ids = groupPrices.list().prices().stream().map(GroupPriceView::groupId).toList();
        List<ChatPicker.Option> found = groups.findGroups(ids).stream()
                .filter(group -> !group.archived())
                .sorted(Comparator.comparing(GroupSummary::name, String.CASE_INSENSITIVE_ORDER))
                .map(group -> new ChatPicker.Option(GROUP + group.id(), "Группа «" + group.name() + "»"))
                .toList();
        return Stream.concat(students().stream(), found.stream()).toList();
    }

    Optional<StudentSummary> student(UUID studentId) {
        return users.findStudent(studentId).filter(StudentSummary::isCurrent);
    }

    Optional<GroupSummary> group(UUID groupId) {
        return groups.findGroup(groupId).filter(group -> !group.archived());
    }

    /** Members of the group who still study. */
    List<UUID> members(GroupSummary group) {
        return users.findStudents(group.memberIds()).stream()
                .filter(StudentSummary::isCurrent)
                .map(StudentSummary::id)
                .toList();
    }

    long studentPrice(UUID studentId) {
        return queries.ledger(studentId).lessonPrice();
    }

    long groupPrice(UUID groupId) {
        return groupPrices.lessonPrice(groupId).amountMinor();
    }

    String currency(UUID studentId) {
        return queries.ledger(studentId).currency();
    }

    /** «аванс 1 500 ₽», «задолженность 1 500 ₽» or «долгов нет». */
    String balance(UUID studentId) {
        StudentLedger ledger = queries.ledger(studentId);
        long balance = ledger.balance();
        Currency currency = Currency.getInstance(ledger.currency());
        if (balance < 0) {
            return "задолженность " + money(-balance, currency);
        }
        return balance > 0 ? "аванс " + money(balance, currency) : "долгов нет";
    }

    static String money(long amount, Currency currency) {
        return MoneyFormat.russian(Money.of(amount, currency));
    }
}

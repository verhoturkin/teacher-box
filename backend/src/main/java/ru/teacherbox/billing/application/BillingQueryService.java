package ru.teacherbox.billing.application;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.billing.application.BillingViews.BillingSummary;
import ru.teacherbox.billing.application.BillingViews.Debtor;
import ru.teacherbox.billing.application.BillingViews.JournalLesson;
import ru.teacherbox.billing.application.BillingViews.JournalPayment;
import ru.teacherbox.billing.application.BillingViews.LessonView;
import ru.teacherbox.billing.application.BillingViews.MonthlyReport;
import ru.teacherbox.billing.application.BillingViews.MonthlyStudentRow;
import ru.teacherbox.billing.application.BillingViews.MyBillingSummary;
import ru.teacherbox.billing.application.BillingViews.Overview;
import ru.teacherbox.billing.application.BillingViews.PaymentView;
import ru.teacherbox.billing.application.BillingViews.StudentBalance;
import ru.teacherbox.billing.application.BillingViews.StudentLedger;
import ru.teacherbox.billing.domain.BalanceTotals;
import ru.teacherbox.billing.domain.BillingCurrency;
import ru.teacherbox.billing.domain.Lesson;
import ru.teacherbox.billing.domain.LessonStatus;
import ru.teacherbox.billing.domain.Payment;
import ru.teacherbox.billing.domain.StudentAccount;
import ru.teacherbox.billing.persistence.BalanceQueries;
import ru.teacherbox.billing.persistence.LessonRepository;
import ru.teacherbox.billing.persistence.PaymentRepository;
import ru.teacherbox.billing.persistence.StudentAccountRepository;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Balances, histories and reports. */
@Service
@Transactional(readOnly = true)
public class BillingQueryService {

    private static final String UNKNOWN_STUDENT = "Неизвестный ученик";
    private static final int TOP_DEBTORS = 5;

    private final StudentAccountRepository accounts;
    private final LessonRepository lessons;
    private final PaymentRepository payments;
    private final BalanceQueries balances;
    private final UserDirectory directory;
    private final BillingService billingService;
    private final BillingProperties properties;
    private final BillingCurrency currency;
    private final InstanceTimeZone timeZone;
    private final Clock clock;

    public BillingQueryService(StudentAccountRepository accounts, LessonRepository lessons,
            PaymentRepository payments, BalanceQueries balances, UserDirectory directory,
            BillingService billingService, BillingProperties properties, BillingCurrency currency,
            InstanceTimeZone timeZone, Clock clock) {
        this.accounts = accounts;
        this.lessons = lessons;
        this.payments = payments;
        this.balances = balances;
        this.directory = directory;
        this.billingService = billingService;
        this.properties = properties;
        this.currency = currency;
        this.timeZone = timeZone;
        this.clock = clock;
    }

    /** Current students plus deactivated students that still have ledger entries. */
    public Overview overview() {
        Map<UUID, BalanceTotals> totals = balances.totalsByStudent();
        Map<UUID, Long> prices = accounts.findAll().stream()
                .collect(Collectors.toMap(StudentAccount::studentId, account -> account.lessonPrice().amountMinor()));
        long defaultPrice = billingService.defaultPrice().amountMinor();

        Set<UUID> ids = new HashSet<>(totals.keySet());
        directory.currentStudents().forEach(student -> ids.add(student.id()));
        List<StudentBalance> rows = directory.findStudents(ids).stream()
                .map(student -> StudentBalance.of(student.id(), student.displayName(), student.status(),
                        prices.getOrDefault(student.id(), defaultPrice),
                        totals.getOrDefault(student.id(), BalanceTotals.empty(currency.currency()))))
                .sorted(Comparator.comparing(StudentBalance::displayName, String.CASE_INSENSITIVE_ORDER))
                .toList();

        long debt = rows.stream().mapToLong(StudentBalance::balance).filter(b -> b < 0).map(Math::negateExact).sum();
        long prepaid = rows.stream().mapToLong(StudentBalance::balance).filter(b -> b > 0).sum();
        return new Overview(currency.code(), defaultPrice, properties.defaultLessonDuration(), debt, prepaid, rows);
    }

    public BillingSummary summary() {
        Overview overview = overview();
        List<Debtor> debtors = overview.students().stream()
                .filter(student -> student.balance() < 0)
                .sorted(Comparator.comparingLong(StudentBalance::balance))
                .map(student -> new Debtor(student.studentId(), student.displayName(), student.balance()))
                .toList();
        YearMonth month = YearMonth.from(timeZone.today(clock));
        long income = payments.findBetween(month.atDay(1), month.atEndOfMonth()).stream()
                .filter(payment -> !payment.isVoided())
                .mapToLong(payment -> payment.amount().amountMinor())
                .sum();
        boolean priceSet = overview.defaultLessonPrice() > 0
                || overview.students().stream().anyMatch(student -> student.lessonPrice() > 0);
        return new BillingSummary(overview.currency(), overview.totalDebt(), debtors.size(),
                debtors.stream().limit(TOP_DEBTORS).toList(), income, month.toString(), priceSet);
    }

    public MyBillingSummary studentSummary(UUID studentId) {
        StudentLedger ledger = ledger(studentId);
        PaymentView last = ledger.payments().stream()
                .filter(payment -> payment.voidedAt() == null)
                .max(Comparator.comparing(PaymentView::paidOn).thenComparing(PaymentView::createdAt))
                .orElse(null);
        return new MyBillingSummary(ledger.currency(), ledger.balance(), ledger.lessonPrice(), last);
    }

    public StudentLedger ledger(UUID studentId) {
        StudentSummary student = directory.findStudent(studentId)
                .orElseThrow(() -> new NotFoundException("student.not-found", "Student not found"));
        long price = accounts.findById(studentId)
                .map(account -> account.lessonPrice().amountMinor())
                .orElseGet(() -> billingService.defaultPrice().amountMinor());
        BalanceTotals totals = balances.totalsOf(studentId);
        return new StudentLedger(currency.code(), studentId, student.displayName(), price,
                totals.balance().amountMinor(), totals.charged().amountMinor(), totals.paid().amountMinor(),
                lessons.findByStudent(studentId).stream().map(LessonView::of).toList(),
                payments.findByStudent(studentId).stream().map(PaymentView::of).toList());
    }

    public MonthlyReport monthlyReport(YearMonth month) {
        LocalDate from = month.atDay(1);
        LocalDate to = month.atEndOfMonth();
        List<Lesson> monthLessons = lessons.findBetween(from, to);
        List<Payment> monthPayments = payments.findBetween(from, to);
        Map<UUID, String> names = namesOf(Stream.concat(
                monthLessons.stream().map(Lesson::studentId), monthPayments.stream().map(Payment::studentId))
                .collect(Collectors.toSet()));

        Map<UUID, MonthTotals> perStudent = new LinkedHashMap<>();
        for (Lesson lesson : monthLessons) {
            if (lesson.status().isCharged()) {
                MonthTotals totals = perStudent.computeIfAbsent(lesson.studentId(), id -> new MonthTotals());
                totals.lessons++;
                totals.charged += lesson.price().amountMinor();
            }
        }
        for (Payment payment : monthPayments) {
            if (!payment.isVoided()) {
                perStudent.computeIfAbsent(payment.studentId(), id -> new MonthTotals()).paid +=
                        payment.amount().amountMinor();
            }
        }
        List<MonthlyStudentRow> rows = perStudent.entrySet().stream()
                .map(entry -> new MonthlyStudentRow(entry.getKey(), nameOf(names, entry.getKey()),
                        entry.getValue().lessons, entry.getValue().charged, entry.getValue().paid))
                .sorted(Comparator.comparing(MonthlyStudentRow::displayName, String.CASE_INSENSITIVE_ORDER))
                .toList();

        return new MonthlyReport(
                month.toString(),
                currency.code(),
                rows.stream().mapToLong(MonthlyStudentRow::paid).sum(),
                rows.stream().mapToLong(MonthlyStudentRow::charged).sum(),
                count(monthLessons, LessonStatus.CONDUCTED),
                count(monthLessons, LessonStatus.MISSED),
                count(monthLessons, LessonStatus.CANCELLED),
                rows,
                monthLessons.stream()
                        .map(lesson -> new JournalLesson(nameOf(names, lesson.studentId()), LessonView.of(lesson)))
                        .toList(),
                monthPayments.stream()
                        .map(payment -> new JournalPayment(nameOf(names, payment.studentId()), PaymentView.of(payment)))
                        .toList());
    }

    private Map<UUID, String> namesOf(Set<UUID> ids) {
        return directory.findStudents(ids).stream()
                .collect(Collectors.toMap(StudentSummary::id, StudentSummary::displayName, (a, b) -> a));
    }

    private static String nameOf(Map<UUID, String> names, UUID id) {
        return names.getOrDefault(id, UNKNOWN_STUDENT);
    }

    private static int count(List<Lesson> lessons, LessonStatus status) {
        return Math.toIntExact(lessons.stream().filter(lesson -> lesson.status() == status).count());
    }

    /** Per-student sums of a month. */
    private static final class MonthTotals {
        private int lessons;
        private long charged;
        private long paid;
    }
}

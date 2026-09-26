package ru.teacherbox.billing.application;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.billing.api.LessonCancelled;
import ru.teacherbox.billing.api.LessonRecorded;
import ru.teacherbox.billing.api.PaymentRecorded;
import ru.teacherbox.billing.api.PaymentVoided;
import ru.teacherbox.billing.application.BillingViews.LessonView;
import ru.teacherbox.billing.application.BillingViews.PaymentView;
import ru.teacherbox.billing.domain.BillingCurrency;
import ru.teacherbox.billing.domain.Lesson;
import ru.teacherbox.billing.domain.LessonStatus;
import ru.teacherbox.billing.domain.Payment;
import ru.teacherbox.billing.domain.PaymentMethod;
import ru.teacherbox.billing.domain.StudentAccount;
import ru.teacherbox.billing.persistence.BalanceQueries;
import ru.teacherbox.billing.persistence.LessonRepository;
import ru.teacherbox.billing.persistence.PaymentRepository;
import ru.teacherbox.billing.persistence.StudentAccountRepository;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.schedule.api.LessonCompleted;
import ru.teacherbox.schedule.api.LessonCompletionRevoked;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.money.Money;

/** Changes of the ledger: lessons, payments and lesson prices. Only the teacher calls these operations. */
@Service
public class BillingService {

    /** Reason of a charge cancelled because its outcome in the schedule was changed. */
    static final String SCHEDULE_CHANGED = "Итог занятия изменён в расписании";

    /**
     * @param durationMinutes defaults to the configured lesson duration
     * @param price           minor units; defaults to the student's lesson price
     */
    public record RecordLesson(UUID studentId, LocalDate date, @Nullable Integer durationMinutes,
            @Nullable Long price, @Nullable String topic, LessonStatus status) {
    }

    /** @param amount minor units */
    public record RecordPayment(UUID studentId, long amount, LocalDate paidOn, PaymentMethod method,
            @Nullable String comment) {
    }

    private final StudentAccountRepository accounts;
    private final LessonRepository lessons;
    private final PaymentRepository payments;
    private final BalanceQueries balances;
    private final UserDirectory directory;
    private final ApplicationEventPublisher events;
    private final BillingProperties properties;
    private final BillingCurrency currency;
    private final Clock clock;

    public BillingService(StudentAccountRepository accounts, LessonRepository lessons, PaymentRepository payments,
            BalanceQueries balances, UserDirectory directory, ApplicationEventPublisher events,
            BillingProperties properties, BillingCurrency currency, Clock clock) {
        this.accounts = accounts;
        this.lessons = lessons;
        this.payments = payments;
        this.balances = balances;
        this.directory = directory;
        this.events = events;
        this.properties = properties;
        this.currency = currency;
        this.clock = clock;
    }

    @Transactional
    public LessonView recordLesson(RecordLesson command) {
        StudentAccount account = accountOf(command.studentId());
        Instant now = clock.instant();
        Money price = command.price() == null ? account.lessonPrice() : currency.of(command.price());
        int duration = command.durationMinutes() == null
                ? properties.defaultLessonDuration()
                : command.durationMinutes();
        Lesson lesson = Lesson.record(Ids.newId(), command.studentId(), command.date(), duration, price,
                command.topic(), command.status(), now);
        insert(lesson, null, now);
        return LessonView.of(lesson);
    }

    /**
     * Charges a lesson whose outcome the teacher marked in the schedule, at the student's lesson price.
     * An outcome that is already charged is skipped (events may be delivered again).
     */
    @Transactional
    public void recordScheduledLesson(LessonCompleted completed) {
        if (lessons.findByScheduleCompletion(completed.completionId()).isPresent()) {
            return;
        }
        StudentAccount account = accountOf(completed.studentId());
        Instant now = clock.instant();
        Lesson lesson = Lesson.record(Ids.newId(), completed.studentId(), completed.date(),
                completed.durationMinutes(), account.lessonPrice(), completed.topic(),
                completed.missed() ? LessonStatus.MISSED : LessonStatus.CONDUCTED, now);
        insert(lesson, completed.completionId(), now);
    }

    /** The outcome in the schedule was withdrawn: its charge is cancelled (and stays in the history). */
    @Transactional
    public void revokeScheduledLesson(LessonCompletionRevoked revoked) {
        lessons.findByScheduleCompletion(revoked.completionId())
                .filter(lesson -> lesson.status() != LessonStatus.CANCELLED)
                .ifPresent(lesson -> cancelLesson(lesson.id(), SCHEDULE_CHANGED));
    }

    private void insert(Lesson lesson, @Nullable UUID scheduleCompletionId, Instant now) {
        lessons.insert(lesson, scheduleCompletionId);
        events.publishEvent(new LessonRecorded(lesson.id(), lesson.studentId(), lesson.date(),
                lesson.durationMinutes(), lesson.price(), lesson.status() == LessonStatus.MISSED,
                balanceOf(lesson.studentId()), now));
    }

    @Transactional
    public LessonView cancelLesson(UUID lessonId, @Nullable String reason) {
        Lesson lesson = lessons.findById(lessonId)
                .orElseThrow(() -> new NotFoundException("lesson.not-found", "Lesson not found"));
        Instant now = clock.instant();
        lesson.cancel(reason, now);
        lessons.updateStatus(lesson);
        events.publishEvent(new LessonCancelled(lesson.id(), lesson.studentId(), lesson.date(),
                balanceOf(lesson.studentId()), now));
        return LessonView.of(lesson);
    }

    @Transactional
    public PaymentView recordPayment(RecordPayment command) {
        accountOf(command.studentId());
        Instant now = clock.instant();
        Payment payment = Payment.record(Ids.newId(), command.studentId(), currency.of(command.amount()),
                command.paidOn(), command.method(), command.comment(), now);
        payments.insert(payment);
        events.publishEvent(new PaymentRecorded(payment.id(), payment.studentId(), payment.amount(),
                payment.paidOn(), balanceOf(payment.studentId()), now));
        return PaymentView.of(payment);
    }

    @Transactional
    public PaymentView voidPayment(UUID paymentId, @Nullable String reason) {
        Payment payment = payments.findById(paymentId)
                .orElseThrow(() -> new NotFoundException("payment.not-found", "Payment not found"));
        Instant now = clock.instant();
        payment.voidPayment(reason, now);
        payments.updateVoiding(payment);
        events.publishEvent(new PaymentVoided(payment.id(), payment.studentId(), payment.amount(),
                balanceOf(payment.studentId()), now));
        return PaymentView.of(payment);
    }

    /** @param price minor units */
    @Transactional
    public long changeLessonPrice(UUID studentId, long price) {
        StudentAccount account = accountOf(studentId);
        account.changeLessonPrice(currency.of(price), clock.instant());
        accounts.update(account);
        return account.lessonPrice().amountMinor();
    }

    /** Opens the billing account of a new student with the default price; does nothing if it exists. */
    @Transactional
    public void openAccount(UUID studentId) {
        if (accounts.findById(studentId).isEmpty()) {
            accounts.insert(StudentAccount.open(studentId, defaultPrice(), clock.instant()));
        }
    }

    Money defaultPrice() {
        return Money.ofDecimal(properties.defaultLessonPrice(), currency.currency());
    }

    /** The student's account; created on the fly for students registered before billing existed. */
    private StudentAccount accountOf(UUID studentId) {
        if (directory.findStudent(studentId).isEmpty()) {
            throw new NotFoundException("student.not-found", "Student not found");
        }
        return accounts.findById(studentId).orElseGet(() -> {
            StudentAccount account = StudentAccount.open(studentId, defaultPrice(), clock.instant());
            accounts.insert(account);
            return account;
        });
    }

    private Money balanceOf(UUID studentId) {
        return balances.totalsOf(studentId).balance();
    }
}

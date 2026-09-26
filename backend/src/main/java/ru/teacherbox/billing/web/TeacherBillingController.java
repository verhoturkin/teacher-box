package ru.teacherbox.billing.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.billing.application.BillingQueryService;
import ru.teacherbox.billing.application.BillingService;
import ru.teacherbox.billing.application.BillingViews.LessonView;
import ru.teacherbox.billing.application.BillingViews.BillingSummary;
import ru.teacherbox.billing.application.BillingViews.MonthlyReport;
import ru.teacherbox.billing.application.BillingViews.Overview;
import ru.teacherbox.billing.application.BillingViews.PaymentView;
import ru.teacherbox.billing.application.BillingViews.StudentLedger;
import ru.teacherbox.billing.domain.LessonStatus;
import ru.teacherbox.billing.domain.PaymentMethod;

/** The teacher's billing API. Amounts are integers in minor currency units. */
@RestController
@RequestMapping("/api/teacher/billing")
class TeacherBillingController {

    record LessonRequest(
            @NotNull UUID studentId,
            @NotNull LocalDate date,
            @Min(1) @Max(600) @Nullable Integer durationMinutes,
            @PositiveOrZero @Nullable Long price,
            @Size(max = 500) @Nullable String topic,
            @Nullable LessonStatus status) {
    }

    record PaymentRequest(
            @NotNull UUID studentId,
            @NotNull Long amount,
            @NotNull LocalDate paidOn,
            @NotNull PaymentMethod method,
            @Size(max = 500) @Nullable String comment) {
    }

    record ReasonRequest(@Size(max = 500) @Nullable String reason) {
    }

    record PriceRequest(@NotNull @PositiveOrZero Long lessonPrice) {
    }

    record PriceResponse(UUID studentId, long lessonPrice) {
    }

    private final BillingService billing;
    private final BillingQueryService queries;

    TeacherBillingController(BillingService billing, BillingQueryService queries) {
        this.billing = billing;
        this.queries = queries;
    }

    @GetMapping("/overview")
    Overview overview() {
        return queries.overview();
    }

    @GetMapping("/summary")
    BillingSummary summary() {
        return queries.summary();
    }

    @GetMapping("/students/{studentId}")
    StudentLedger ledger(@PathVariable UUID studentId) {
        return queries.ledger(studentId);
    }

    @PutMapping("/students/{studentId}/price")
    PriceResponse changePrice(@PathVariable UUID studentId, @Valid @RequestBody PriceRequest request) {
        return new PriceResponse(studentId, billing.changeLessonPrice(studentId, request.lessonPrice()));
    }

    @PostMapping("/lessons")
    @ResponseStatus(HttpStatus.CREATED)
    LessonView recordLesson(@Valid @RequestBody LessonRequest request) {
        LessonStatus status = request.status() == null ? LessonStatus.CONDUCTED : request.status();
        return billing.recordLesson(new BillingService.RecordLesson(request.studentId(), request.date(),
                request.durationMinutes(), request.price(), request.topic(), status));
    }

    @PostMapping("/lessons/{lessonId}/cancel")
    LessonView cancelLesson(@PathVariable UUID lessonId, @Valid @RequestBody(required = false)
            @Nullable ReasonRequest request) {
        return billing.cancelLesson(lessonId, request == null ? null : request.reason());
    }

    @PostMapping("/payments")
    @ResponseStatus(HttpStatus.CREATED)
    PaymentView recordPayment(@Valid @RequestBody PaymentRequest request) {
        return billing.recordPayment(new BillingService.RecordPayment(request.studentId(), request.amount(),
                request.paidOn(), request.method(), request.comment()));
    }

    @PostMapping("/payments/{paymentId}/void")
    PaymentView voidPayment(@PathVariable UUID paymentId, @Valid @RequestBody(required = false)
            @Nullable ReasonRequest request) {
        return billing.voidPayment(paymentId, request == null ? null : request.reason());
    }

    /** @param month {@code yyyy-MM} */
    @GetMapping("/reports/monthly")
    MonthlyReport monthlyReport(@RequestParam YearMonth month) {
        return queries.monthlyReport(month);
    }
}

package ru.teacherbox.billing.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
import ru.teacherbox.billing.application.DefaultLessonPrice;
import ru.teacherbox.billing.application.GroupPriceService;
import ru.teacherbox.billing.application.GroupPriceService.GroupPrices;
import ru.teacherbox.billing.application.GroupPriceService.GroupPriceView;
import ru.teacherbox.billing.application.BillingViews.LessonView;
import ru.teacherbox.billing.application.BillingViews.BillingSummary;
import ru.teacherbox.billing.application.BillingViews.MonthlyReport;
import ru.teacherbox.billing.application.BillingViews.OperationKind;
import ru.teacherbox.billing.application.BillingViews.Operations;
import ru.teacherbox.billing.application.BillingViews.Overview;
import ru.teacherbox.billing.application.BillingViews.PaymentView;
import ru.teacherbox.billing.application.BillingViews.StudentLedger;
import ru.teacherbox.billing.domain.LessonStatus;

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
            @Size(max = 500) @Nullable String comment) {
    }

    record ReasonRequest(@Size(max = 500) @Nullable String reason) {
    }

    record PriceRequest(@NotNull @PositiveOrZero Long lessonPrice) {
    }

    record PriceResponse(UUID studentId, long lessonPrice) {
    }

    record DefaultPriceResponse(long lessonPrice) {
    }

    private final BillingService billing;
    private final BillingQueryService queries;
    private final GroupPriceService groupPrices;
    private final DefaultLessonPrice defaultLessonPrice;

    TeacherBillingController(BillingService billing, BillingQueryService queries, GroupPriceService groupPrices,
            DefaultLessonPrice defaultLessonPrice) {
        this.billing = billing;
        this.queries = queries;
        this.groupPrices = groupPrices;
        this.defaultLessonPrice = defaultLessonPrice;
    }

    @GetMapping("/overview")
    Overview overview() {
        return queries.overview();
    }

    @GetMapping("/summary")
    BillingSummary summary(@RequestParam(required = false) @Nullable YearMonth month) {
        return queries.summary(month);
    }

    /**
     * The journal of a month: payments, lessons and absences, newest first.
     *
     * @param month {@code yyyy-MM}; default: the current month
     */
    @GetMapping("/operations")
    Operations operations(@RequestParam(required = false) @Nullable YearMonth month,
            @RequestParam(required = false) @Nullable OperationKind kind,
            @RequestParam(required = false) @Nullable UUID studentId) {
        return queries.operations(month == null ? queries.currentMonth() : month, kind, studentId);
    }

    /** The same journal as a CSV download (for the teacher's spreadsheet). */
    @GetMapping("/operations.csv")
    ResponseEntity<byte[]> operationsCsv(@RequestParam(required = false) @Nullable YearMonth month,
            @RequestParam(required = false) @Nullable OperationKind kind,
            @RequestParam(required = false) @Nullable UUID studentId) {
        Operations journal = queries.operations(month == null ? queries.currentMonth() : month, kind, studentId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("operations-" + journal.month() + ".csv").build()
                                .toString())
                .body(OperationsCsv.of(journal));
    }

    @GetMapping("/students/{studentId}")
    StudentLedger ledger(@PathVariable UUID studentId) {
        return queries.ledger(studentId);
    }

    /** Price of students and groups added from now on. */
    @PutMapping("/default-price")
    DefaultPriceResponse changeDefaultPrice(@Valid @RequestBody PriceRequest request) {
        return new DefaultPriceResponse(defaultLessonPrice.change(request.lessonPrice()));
    }

    @PutMapping("/students/{studentId}/price")
    PriceResponse changePrice(@PathVariable UUID studentId, @Valid @RequestBody PriceRequest request) {
        return new PriceResponse(studentId, billing.changeLessonPrice(studentId, request.lessonPrice()));
    }

    @GetMapping("/groups")
    GroupPrices groupPrices() {
        return groupPrices.list();
    }

    @PutMapping("/groups/{groupId}/price")
    GroupPriceView changeGroupPrice(@PathVariable UUID groupId, @Valid @RequestBody PriceRequest request) {
        return groupPrices.change(groupId, request.lessonPrice());
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
                request.paidOn(), request.comment()));
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

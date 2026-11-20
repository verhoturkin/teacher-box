package ru.teacherbox.billing.web;

import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.billing.application.BillingQueryService;
import ru.teacherbox.billing.application.BillingViews.MyBillingSummary;
import ru.teacherbox.billing.application.BillingViews.StudentLedger;
import ru.teacherbox.billing.application.ReceiptService;
import ru.teacherbox.shared.security.CurrentUser;
import ru.teacherbox.shared.security.GuardianAccess;

/**
 * The family cabinet (ADR-0069): a guardian reads a child's balance, history and receipts as the child sees
 * them, through the same services as {@code /api/me/billing} after {@link GuardianAccess#require}.
 */
@RestController
@RequestMapping("/api/guardian/students/{studentId}/billing")
class GuardianBillingController {

    private final GuardianAccess access;
    private final BillingQueryService queries;
    private final ReceiptService receipts;

    GuardianBillingController(GuardianAccess access, BillingQueryService queries, ReceiptService receipts) {
        this.access = access;
        this.queries = queries;
        this.receipts = receipts;
    }

    @GetMapping
    StudentLedger ledger(CurrentUser user, @PathVariable UUID studentId) {
        access.require(user, studentId);
        return queries.ledger(studentId);
    }

    @GetMapping("/summary")
    MyBillingSummary summary(CurrentUser user, @PathVariable UUID studentId) {
        access.require(user, studentId);
        return queries.studentSummary(studentId);
    }

    @GetMapping("/payments/{paymentId}/receipt")
    ResponseEntity<Resource> receipt(CurrentUser user, @PathVariable UUID studentId, @PathVariable UUID paymentId) {
        access.require(user, studentId);
        return ReceiptController.response(receipts.downloadOwn(studentId, paymentId));
    }
}

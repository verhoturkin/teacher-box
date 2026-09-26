package ru.teacherbox.billing.web;

import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.billing.application.BillingQueryService;
import ru.teacherbox.billing.application.BillingViews.MyBillingSummary;
import ru.teacherbox.billing.application.BillingViews.StudentLedger;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.security.CurrentUser;

/** The student's own balance and history (personal area). */
@RestController
class MyBillingController {

    private final BillingQueryService queries;

    MyBillingController(BillingQueryService queries) {
        this.queries = queries;
    }

    @GetMapping("/api/me/billing")
    StudentLedger myBilling(CurrentUser user) {
        return queries.ledger(studentId(user));
    }

    @GetMapping("/api/me/billing/summary")
    MyBillingSummary summary(CurrentUser user) {
        return queries.studentSummary(studentId(user));
    }

    private static UUID studentId(CurrentUser user) {
        if (user.isTeacher()) {
            throw new ForbiddenException("billing.students-only", "Billing history is available to students only");
        }
        return user.id();
    }
}

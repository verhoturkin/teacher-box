package ru.teacherbox.billing.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.billing.application.BillingQueryService;
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
        if (user.isTeacher()) {
            throw new ForbiddenException("billing.students-only", "Billing history is available to students only");
        }
        return queries.ledger(user.id());
    }
}

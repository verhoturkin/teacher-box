package ru.teacherbox.billing.web;

import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.billing.application.BillingQueryService;
import ru.teacherbox.billing.application.BillingViews.MyBillingSummary;
import ru.teacherbox.billing.application.BillingViews.StudentLedger;
import ru.teacherbox.billing.application.PaymentVisibilityService;
import ru.teacherbox.shared.error.ForbiddenException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.security.CurrentUser;

/**
 * The student's own balance and history (personal area). While the teacher has switched on «Оплаты видит только
 * родитель» (ADR-0069) the history is not found; the guardian's reads go round this controller.
 */
@RestController
class MyBillingController {

    /** Whether the cabinet shows «Оплаты»: {@code false} while only the guardians see the payments. */
    record Visibility(boolean visible) {
    }

    private final BillingQueryService queries;
    private final PaymentVisibilityService visibility;

    MyBillingController(BillingQueryService queries, PaymentVisibilityService visibility) {
        this.queries = queries;
        this.visibility = visibility;
    }

    @GetMapping("/api/me/billing")
    StudentLedger myBilling(CurrentUser user) {
        return queries.ledger(visibleStudentId(user, visibility));
    }

    @GetMapping("/api/me/billing/summary")
    MyBillingSummary summary(CurrentUser user) {
        return queries.studentSummary(visibleStudentId(user, visibility));
    }

    @GetMapping("/api/me/billing/visible")
    Visibility visible(CurrentUser user) {
        return new Visibility(!visibility.hiddenFromStudent(studentId(user)));
    }

    /** The student's own id; 404 {@code billing.hidden} while the payments are hidden from the student. */
    static UUID visibleStudentId(CurrentUser user, PaymentVisibilityService visibility) {
        UUID id = studentId(user);
        if (visibility.hiddenFromStudent(id)) {
            throw new NotFoundException("billing.hidden", "Payments are not shown to this student");
        }
        return id;
    }

    private static UUID studentId(CurrentUser user) {
        if (user.isTeacher()) {
            throw new ForbiddenException("billing.students-only", "Billing history is available to students only");
        }
        return user.id();
    }
}

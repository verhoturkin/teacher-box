package ru.teacherbox.billing.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.billing.application.BillingCurrencySetting;
import ru.teacherbox.billing.application.BillingCurrencySetting.CurrencyView;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.security.CurrentUser;

/** The instance currency (ADR-0056): {@code locked} once a charge or a payment is recorded (then 409). */
@RestController
@RequestMapping("/api/teacher/billing/currency")
class TeacherCurrencyController {

    /** @param currency an ISO 4217 code, e.g. {@code EUR} */
    record CurrencyRequest(@NotBlank @Size(max = 3) String currency) {
    }

    private final BillingCurrencySetting currency;

    TeacherCurrencyController(BillingCurrencySetting currency) {
        this.currency = currency;
    }

    @GetMapping
    CurrencyView current() {
        return currency.view();
    }

    @PutMapping
    CurrencyView change(CurrentUser user, @Valid @RequestBody CurrencyRequest request) {
        CurrencyView changed = currency.change(request.currency());
        AuditLog.record(user.id(), "currency", changed.currency());
        return changed;
    }
}

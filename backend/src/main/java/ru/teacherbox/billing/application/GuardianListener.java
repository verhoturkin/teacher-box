package ru.teacherbox.billing.application;

import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.GuardianUnlinked;

/** The last guardian unlinked from a student switches «Оплаты видит только родитель» off (ADR-0069). */
@Component
class GuardianListener {

    private final PaymentVisibilityService visibility;

    GuardianListener(PaymentVisibilityService visibility) {
        this.visibility = visibility;
    }

    @ApplicationModuleListener
    void on(GuardianUnlinked event) {
        visibility.guardianUnlinked(event.studentId());
    }
}

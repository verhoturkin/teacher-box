package ru.teacherbox.billing.application;

import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.StudentRegistered;

/** Opens a billing account with the default lesson price for every new student. */
@Component
class StudentRegistrationListener {

    private final BillingService billingService;

    StudentRegistrationListener(BillingService billingService) {
        this.billingService = billingService;
    }

    @ApplicationModuleListener
    void on(StudentRegistered event) {
        billingService.openAccount(event.studentId());
    }
}

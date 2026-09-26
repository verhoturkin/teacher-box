package ru.teacherbox.billing.application;

import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.api.LessonCompleted;
import ru.teacherbox.schedule.api.LessonCompletionRevoked;

/** Lesson outcomes marked in the schedule are charged in the lesson log. */
@Component
class ScheduleListener {

    private final BillingService billingService;

    ScheduleListener(BillingService billingService) {
        this.billingService = billingService;
    }

    @ApplicationModuleListener
    void on(LessonCompleted event) {
        billingService.recordScheduledLesson(event);
    }

    @ApplicationModuleListener
    void on(LessonCompletionRevoked event) {
        billingService.revokeScheduledLesson(event);
    }
}

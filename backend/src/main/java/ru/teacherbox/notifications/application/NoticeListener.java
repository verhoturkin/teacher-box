package ru.teacherbox.notifications.application;

import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.notice.NoticeRequested;

/**
 * The notices the modules write (ADR-0061) → the inbox and the recipient's messengers. Runs after
 * the module's transaction commits, in its own one; the event registry keeps the notice until then.
 */
@Component
class NoticeListener {

    private final NotificationService notifications;

    NoticeListener(NotificationService notifications) {
        this.notifications = notifications;
    }

    @ApplicationModuleListener
    void on(NoticeRequested notice) {
        notifications.notify(notice);
    }
}

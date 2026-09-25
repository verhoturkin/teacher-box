package ru.teacherbox.notifications.application;

import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.StudentActivated;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.notifications.domain.NotificationKind;

/** Identity events → notifications to the teacher. */
@Component
class StudentNotifications {

    private final NotificationService notifications;
    private final UserDirectory users;

    StudentNotifications(NotificationService notifications, UserDirectory users) {
        this.notifications = notifications;
        this.users = users;
    }

    @ApplicationModuleListener
    void on(StudentActivated event) {
        notifications.notify(users.teacherId(), NotificationKind.STUDENT_ACTIVATED,
                "Ученик присоединился к порталу",
                event.displayName() + " принял(а) приглашение и теперь может войти в личный кабинет.",
                "/teacher/students");
    }
}

package ru.teacherbox.notifications.application;

import java.util.UUID;
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
        UUID teacher = users.teacherId();
        NotificationMessages t = NotificationMessages.of(users.language(teacher));
        notifications.notify(teacher, NotificationKind.STUDENT_ACTIVATED, t.studentJoined(),
                t.studentJoinedBody(event.displayName()), "/teacher/students");
    }
}

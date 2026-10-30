package ru.teacherbox.notifications.application;

import java.util.UUID;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.homework.api.HomeworkAssigned;
import ru.teacherbox.homework.api.HomeworkDueSoon;
import ru.teacherbox.homework.api.HomeworkReminderRequested;
import ru.teacherbox.homework.api.HomeworkReviewed;
import ru.teacherbox.homework.api.HomeworkSubmitted;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.notifications.domain.NotificationKind;

/**
 * Homework events → notifications to the student (new task, deadline, review) and the teacher, in the
 * recipient's language.
 */
@Component
class HomeworkNotifications {

    private final NotificationService notifications;
    private final NotificationTexts texts;
    private final UserDirectory users;

    HomeworkNotifications(NotificationService notifications, NotificationTexts texts, UserDirectory users) {
        this.notifications = notifications;
        this.texts = texts;
        this.users = users;
    }

    @ApplicationModuleListener
    void on(HomeworkAssigned event) {
        NotificationMessages t = messagesFor(event.studentId());
        notifications.notify(event.studentId(), NotificationKind.HOMEWORK_ASSIGNED, t.taskAssigned(event.title()),
                event.dueAt() == null ? null : t.dueAt(texts.dateTime(event.dueAt())),
                studentTaskLink(event.taskId()));
    }

    @ApplicationModuleListener
    void on(HomeworkDueSoon event) {
        NotificationMessages t = messagesFor(event.studentId());
        notifications.notify(event.studentId(), NotificationKind.HOMEWORK_DUE_SOON, t.dueSoon(event.title()),
                t.dueAt(texts.dateTime(event.dueAt())), studentTaskLink(event.taskId()));
    }

    @ApplicationModuleListener
    void on(HomeworkReminderRequested event) {
        NotificationMessages t = messagesFor(event.studentId());
        notifications.notify(event.studentId(), NotificationKind.HOMEWORK_REMINDER, t.reminder(event.title()),
                event.dueAt() == null ? null : t.dueAt(texts.dateTime(event.dueAt())),
                studentTaskLink(event.taskId()));
    }

    @ApplicationModuleListener
    void on(HomeworkReviewed event) {
        NotificationMessages t = messagesFor(event.studentId());
        if (event.accepted()) {
            notifications.notify(event.studentId(), NotificationKind.HOMEWORK_REVIEWED, t.taskAccepted(event.title()),
                    event.grade() == null ? null : t.grade(event.grade()), studentTaskLink(event.taskId()));
        } else {
            notifications.notify(event.studentId(), NotificationKind.HOMEWORK_REVIEWED, t.taskReturned(event.title()),
                    t.seeTeacherComment(), studentTaskLink(event.taskId()));
        }
    }

    @ApplicationModuleListener
    void on(HomeworkSubmitted event) {
        UUID teacher = users.teacherId();
        NotificationMessages t = messagesFor(teacher);
        String student = users.findStudent(event.studentId()).map(StudentSummary::displayName)
                .orElse(t.unknownStudent());
        notifications.notify(teacher, NotificationKind.HOMEWORK_SUBMITTED, t.toReview(event.title()),
                t.student(student), "/teacher/homework/tasks/" + event.taskId());
    }

    private NotificationMessages messagesFor(UUID recipientId) {
        return NotificationMessages.of(users.language(recipientId));
    }

    private static String studentTaskLink(UUID taskId) {
        return "/cabinet/homework/" + taskId;
    }
}

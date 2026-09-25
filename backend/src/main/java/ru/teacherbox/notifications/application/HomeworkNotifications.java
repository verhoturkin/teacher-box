package ru.teacherbox.notifications.application;

import java.util.UUID;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.homework.api.HomeworkAssigned;
import ru.teacherbox.homework.api.HomeworkDueSoon;
import ru.teacherbox.homework.api.HomeworkReviewed;
import ru.teacherbox.homework.api.HomeworkSubmitted;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.notifications.domain.NotificationKind;

/** Homework events → notifications to the student (new task, deadline, review) and the teacher. */
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
        notifications.notify(event.studentId(), NotificationKind.HOMEWORK_ASSIGNED,
                "Новое задание: «" + event.title() + "»",
                event.dueAt() == null ? null : "Срок сдачи: " + texts.dateTime(event.dueAt()),
                studentTaskLink(event.taskId()));
    }

    @ApplicationModuleListener
    void on(HomeworkDueSoon event) {
        notifications.notify(event.studentId(), NotificationKind.HOMEWORK_DUE_SOON,
                "Скоро срок сдачи: «" + event.title() + "»",
                "Срок сдачи: " + texts.dateTime(event.dueAt()),
                studentTaskLink(event.taskId()));
    }

    @ApplicationModuleListener
    void on(HomeworkReviewed event) {
        if (event.accepted()) {
            notifications.notify(event.studentId(), NotificationKind.HOMEWORK_REVIEWED,
                    "Задание «" + event.title() + "» принято",
                    event.grade() == null ? null : "Оценка: " + event.grade(),
                    studentTaskLink(event.taskId()));
        } else {
            notifications.notify(event.studentId(), NotificationKind.HOMEWORK_REVIEWED,
                    "Задание «" + event.title() + "» возвращено на доработку",
                    "Посмотрите комментарий учителя.",
                    studentTaskLink(event.taskId()));
        }
    }

    @ApplicationModuleListener
    void on(HomeworkSubmitted event) {
        String student = users.findStudent(event.studentId()).map(StudentSummary::displayName).orElse("Ученик");
        notifications.notify(users.teacherId(), NotificationKind.HOMEWORK_SUBMITTED,
                "Работа на проверку: «" + event.title() + "»",
                "Ученик: " + student,
                "/teacher/homework/tasks/" + event.taskId());
    }

    private static String studentTaskLink(UUID taskId) {
        return "/cabinet/homework/" + taskId;
    }
}

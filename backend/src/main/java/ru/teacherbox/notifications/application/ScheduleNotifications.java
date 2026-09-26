package ru.teacherbox.notifications.application;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.api.LessonChangeRequested;
import ru.teacherbox.schedule.api.LessonChangeResolved;
import ru.teacherbox.schedule.api.LessonRescheduled;
import ru.teacherbox.schedule.api.LessonScheduled;
import ru.teacherbox.schedule.api.LessonStartingSoon;
import ru.teacherbox.schedule.api.ScheduledLessonCancelled;
import ru.teacherbox.schedule.api.SeriesScheduled;
import ru.teacherbox.schedule.api.SeriesStopped;

/**
 * Schedule events → notifications: the student learns about new, moved and cancelled lessons and
 * the answers to their requests; the teacher gets the students' requests. Both get reminders
 * (the teacher only the last one before a lesson).
 */
@Component
class ScheduleNotifications {

    static final String STUDENT_LINK = "/cabinet/schedule";
    static final String TEACHER_LINK = "/teacher/schedule";

    private final NotificationService notifications;
    private final NotificationTexts texts;
    private final UserDirectory users;

    ScheduleNotifications(NotificationService notifications, NotificationTexts texts, UserDirectory users) {
        this.notifications = notifications;
        this.texts = texts;
        this.users = users;
    }

    @ApplicationModuleListener
    void on(LessonScheduled event) {
        notifications.notify(event.studentId(), NotificationKind.SCHEDULE_LESSON_PLANNED,
                "Новое занятие: " + texts.lessonTime(event.startsAt()),
                event.topic() == null ? null : "Тема: " + event.topic(), STUDENT_LINK);
    }

    @ApplicationModuleListener
    void on(SeriesScheduled event) {
        String body = "С " + texts.date(event.startsOn())
                + (event.endsOn() == null ? "" : " по " + texts.date(event.endsOn()))
                + (event.intervalWeeks() == 1 ? "" : ", раз в " + event.intervalWeeks() + " недели") + ".";
        notifications.notify(event.studentId(), NotificationKind.SCHEDULE_LESSON_PLANNED,
                "Регулярные занятия " + texts.weekly(event.weekdays(), event.startTime()), body, STUDENT_LINK);
    }

    @ApplicationModuleListener
    void on(SeriesStopped event) {
        if (event.replaced()) {
            return;
        }
        notifications.notify(event.studentId(), NotificationKind.SCHEDULE_LESSON_CANCELLED,
                "Регулярные занятия завершены",
                "Занятия по расписанию с " + texts.date(event.from()) + " отменены.", STUDENT_LINK);
    }

    @ApplicationModuleListener
    void on(LessonRescheduled event) {
        if (event.byRequest()) {
            return;
        }
        notifications.notify(event.studentId(), NotificationKind.SCHEDULE_LESSON_MOVED,
                "Занятие перенесено на " + texts.lessonTime(event.startsAt()),
                "Было: " + texts.lessonTime(event.previousStartsAt()) + ".", STUDENT_LINK);
    }

    @ApplicationModuleListener
    void on(ScheduledLessonCancelled event) {
        if (event.byRequest()) {
            return;
        }
        List<String> body = new ArrayList<>();
        if (event.reason() != null) {
            body.add("Причина: " + event.reason());
        }
        if (event.charged()) {
            body.add("Занятие засчитано как пропуск.");
        }
        notifications.notify(event.studentId(), NotificationKind.SCHEDULE_LESSON_CANCELLED,
                "Занятие " + texts.lessonTime(event.startsAt()) + " отменено", join(body), STUDENT_LINK);
    }

    @ApplicationModuleListener
    void on(LessonChangeRequested event) {
        String student = name(event.studentId());
        List<String> body = new ArrayList<>();
        body.add("Занятие: " + texts.lessonTime(event.startsAt()) + ".");
        if (event.proposedStartsAt() != null) {
            body.add("Предлагает: " + texts.lessonTime(event.proposedStartsAt()) + ".");
        }
        if (event.late()) {
            body.add("Поздняя отмена.");
        }
        if (event.comment() != null) {
            body.add("Комментарий: " + event.comment());
        }
        notifications.notify(users.teacherId(), NotificationKind.SCHEDULE_REQUEST,
                student + (event.kind() == ChangeKind.RESCHEDULE ? " просит перенести занятие"
                        : " просит отменить занятие"),
                join(body), TEACHER_LINK);
    }

    @ApplicationModuleListener
    void on(LessonChangeResolved event) {
        String title;
        List<String> body = new ArrayList<>();
        if (!event.approved()) {
            title = event.kind() == ChangeKind.RESCHEDULE ? "Перенос занятия не согласован"
                    : "Отмена занятия не согласована";
            body.add("Занятие остаётся: " + texts.lessonTime(event.startsAt()) + ".");
        } else if (event.kind() == ChangeKind.RESCHEDULE) {
            title = "Перенос согласован: " + texts.lessonTime(event.startsAt());
        } else {
            title = "Отмена занятия " + texts.lessonTime(event.startsAt()) + " согласована";
            if (event.charged()) {
                body.add("Отмена поздняя, занятие засчитано как пропуск.");
            }
        }
        if (event.comment() != null) {
            body.add("Комментарий учителя: " + event.comment());
        }
        notifications.notify(event.studentId(), NotificationKind.SCHEDULE_REQUEST_ANSWERED, title, join(body),
                STUDENT_LINK);
    }

    @ApplicationModuleListener
    void on(LessonStartingSoon event) {
        String when = texts.lessonTime(event.startsAt());
        String in = "Через " + texts.duration(event.before()) + ".";
        String link = event.meetingUrl() == null ? "" : " Ссылка на урок: " + event.meetingUrl();
        notifications.notify(event.studentId(), NotificationKind.SCHEDULE_REMINDER, "Скоро занятие: " + when,
                in + (event.topic() == null ? "" : " Тема: " + event.topic() + ".") + link, STUDENT_LINK);
        if (event.lastBefore()) {
            notifications.notify(users.teacherId(), NotificationKind.SCHEDULE_REMINDER,
                    "Скоро урок: " + name(event.studentId()) + ", " + when, in + link, TEACHER_LINK);
        }
    }

    private String name(UUID studentId) {
        return users.findStudent(studentId).map(StudentSummary::displayName).orElse("Ученик");
    }

    private static @Nullable String join(List<String> parts) {
        return parts.isEmpty() ? null : String.join(" ", parts);
    }
}

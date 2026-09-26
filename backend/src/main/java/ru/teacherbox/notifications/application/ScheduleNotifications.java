package ru.teacherbox.notifications.application;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.api.GoogleCalendarDisconnected;
import ru.teacherbox.schedule.api.LessonChangeRequested;
import ru.teacherbox.schedule.api.LessonChangeResolved;
import ru.teacherbox.schedule.api.LessonRescheduled;
import ru.teacherbox.schedule.api.LessonScheduled;
import ru.teacherbox.schedule.api.LessonStartingSoon;
import ru.teacherbox.schedule.api.ScheduledLessonCancelled;
import ru.teacherbox.schedule.api.SeriesScheduled;
import ru.teacherbox.schedule.api.SeriesStopped;

/**
 * Schedule events → notifications: students learn about new, moved and cancelled lessons (all
 * participants of a group lesson) and the answers to their requests; the teacher gets the
 * students' requests. Both get reminders (the teacher only the last one before a lesson).
 */
@Component
class ScheduleNotifications {

    static final String STUDENT_LINK = "/cabinet/schedule";
    static final String TEACHER_LINK = "/teacher/schedule";

    private final NotificationService notifications;
    private final NotificationTexts texts;
    private final UserDirectory users;
    private final StudentGroups groups;

    ScheduleNotifications(NotificationService notifications, NotificationTexts texts, UserDirectory users,
            StudentGroups groups) {
        this.notifications = notifications;
        this.texts = texts;
        this.users = users;
        this.groups = groups;
    }

    @ApplicationModuleListener
    void on(LessonScheduled event) {
        List<String> body = new ArrayList<>();
        group(event.groupId()).ifPresent(name -> body.add("Группа «" + name + "»."));
        if (event.topic() != null) {
            body.add("Тема: " + event.topic());
        }
        notifyStudents(event.studentIds(), NotificationKind.SCHEDULE_LESSON_PLANNED,
                "Новое занятие: " + texts.lessonTime(event.startsAt()), join(body));
    }

    @ApplicationModuleListener
    void on(SeriesScheduled event) {
        String body = group(event.groupId()).map(name -> "Группа «" + name + "». ").orElse("")
                + "С " + texts.date(event.startsOn())
                + (event.endsOn() == null ? "" : " по " + texts.date(event.endsOn()))
                + (event.intervalWeeks() == 1 ? "" : ", раз в " + event.intervalWeeks() + " недели") + ".";
        notifyStudents(event.studentIds(), NotificationKind.SCHEDULE_LESSON_PLANNED,
                "Регулярные занятия " + texts.weekly(event.weekdays(), event.startTime()), body);
    }

    @ApplicationModuleListener
    void on(SeriesStopped event) {
        if (event.replaced()) {
            return;
        }
        notifyStudents(event.studentIds(), NotificationKind.SCHEDULE_LESSON_CANCELLED,
                "Регулярные занятия завершены",
                group(event.groupId()).map(name -> "Группа «" + name + "». ").orElse("")
                        + "Занятия по расписанию с " + texts.date(event.from()) + " отменены.");
    }

    @ApplicationModuleListener
    void on(LessonRescheduled event) {
        List<UUID> recipients = event.studentIds().stream()
                .filter(studentId -> !studentId.equals(event.requestedBy()))
                .toList();
        notifyStudents(recipients, NotificationKind.SCHEDULE_LESSON_MOVED,
                "Занятие перенесено на " + texts.lessonTime(event.startsAt()),
                group(event.groupId()).map(name -> "Группа «" + name + "». ").orElse("")
                        + "Было: " + texts.lessonTime(event.previousStartsAt()) + ".");
    }

    @ApplicationModuleListener
    void on(ScheduledLessonCancelled event) {
        if (event.byRequest()) {
            return;
        }
        List<String> body = new ArrayList<>();
        group(event.groupId()).ifPresent(name -> body.add("Группа «" + name + "»."));
        if (event.reason() != null) {
            body.add("Причина: " + event.reason());
        }
        if (event.charged()) {
            body.add("Занятие засчитано как пропуск.");
        }
        notifyStudents(event.studentIds(), NotificationKind.SCHEDULE_LESSON_CANCELLED,
                "Занятие " + texts.lessonTime(event.startsAt()) + " отменено", join(body));
    }

    @ApplicationModuleListener
    void on(LessonChangeRequested event) {
        String student = name(event.studentId());
        String groupName = group(event.groupId()).orElse(null);
        List<String> body = new ArrayList<>();
        body.add("Занятие: " + texts.lessonTime(event.startsAt())
                + (groupName == null ? "" : ", группа «" + groupName + "»") + ".");
        if (event.proposedStartsAt() != null) {
            body.add("Предлагает: " + texts.lessonTime(event.proposedStartsAt()) + ".");
        }
        if (event.late()) {
            body.add(groupName == null ? "Поздняя отмена." : "Поздно — решите, засчитать ли пропуск.");
        }
        if (event.comment() != null) {
            body.add("Комментарий: " + event.comment());
        }
        String title;
        if (event.kind() == ChangeKind.RESCHEDULE) {
            title = student + " просит перенести занятие";
        } else if (groupName != null) {
            title = student + " не придёт на занятие группы";
        } else {
            title = student + " просит отменить занятие";
        }
        notifications.notify(users.teacherId(), NotificationKind.SCHEDULE_REQUEST, title, join(body), TEACHER_LINK);
    }

    @ApplicationModuleListener
    void on(LessonChangeResolved event) {
        boolean absence = event.groupId() != null && event.kind() == ChangeKind.CANCEL;
        String title;
        List<String> body = new ArrayList<>();
        if (!event.approved()) {
            if (event.kind() == ChangeKind.RESCHEDULE) {
                title = "Перенос занятия не согласован";
            } else {
                title = absence ? "Пропуск занятия не согласован" : "Отмена занятия не согласована";
            }
            body.add("Занятие остаётся: " + texts.lessonTime(event.startsAt()) + ".");
        } else if (event.kind() == ChangeKind.RESCHEDULE) {
            title = "Перенос согласован: " + texts.lessonTime(event.startsAt());
        } else {
            title = absence ? "Учитель знает, что вас не будет " + texts.lessonTime(event.startsAt())
                    : "Отмена занятия " + texts.lessonTime(event.startsAt()) + " согласована";
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
        String groupName = group(event.groupId()).orElse(null);
        notifyStudents(event.studentIds(), NotificationKind.SCHEDULE_REMINDER, "Скоро занятие: " + when,
                in + (groupName == null ? "" : " Группа «" + groupName + "».")
                        + (event.topic() == null ? "" : " Тема: " + event.topic() + ".") + link);
        if (event.lastBefore()) {
            String with = groupName != null ? "группа «" + groupName + "»"
                    : event.studentIds().isEmpty() ? "ученик" : name(event.studentIds().getFirst());
            notifications.notify(users.teacherId(), NotificationKind.SCHEDULE_REMINDER,
                    "Скоро урок: " + with + ", " + when, in + link, TEACHER_LINK);
        }
    }

    @ApplicationModuleListener
    void on(GoogleCalendarDisconnected event) {
        notifications.notify(users.teacherId(), NotificationKind.SCHEDULE_CALENDAR, "Google Календарь отключён",
                "Google больше не принимает доступ портала, занятия не попадают в календарь. "
                        + "Подключите календарь заново в настройках.",
                "/teacher/settings");
    }

    private void notifyStudents(Collection<UUID> studentIds, NotificationKind kind, String title,
            @Nullable String body) {
        for (UUID studentId : studentIds) {
            notifications.notify(studentId, kind, title, body, STUDENT_LINK);
        }
    }

    private Optional<String> group(@Nullable UUID groupId) {
        return groupId == null ? Optional.empty() : groups.findGroup(groupId).map(GroupSummary::name);
    }

    private String name(UUID studentId) {
        return users.findStudent(studentId).map(StudentSummary::displayName).orElse("Ученик");
    }

    private static @Nullable String join(List<String> parts) {
        return parts.isEmpty() ? null : String.join(" ", parts);
    }
}

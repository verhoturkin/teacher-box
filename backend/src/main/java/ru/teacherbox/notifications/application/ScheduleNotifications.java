package ru.teacherbox.notifications.application;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiFunction;
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
import ru.teacherbox.schedule.api.LessonDeleted;
import ru.teacherbox.schedule.api.LessonRescheduled;
import ru.teacherbox.schedule.api.LessonRestored;
import ru.teacherbox.schedule.api.LessonScheduled;
import ru.teacherbox.schedule.api.LessonStartingSoon;
import ru.teacherbox.schedule.api.ScheduledLessonCancelled;
import ru.teacherbox.schedule.api.SeriesScheduled;
import ru.teacherbox.schedule.api.SeriesStopped;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.shared.i18n.Language;

/**
 * Schedule events → notifications: students learn about new, moved and cancelled lessons (all
 * participants of a group lesson) and the answers to their requests; the teacher gets the
 * students' requests. Both get reminders (the teacher only the last one before a lesson). Each
 * recipient reads them in their language (ADR-0036).
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
        notifyStudents(event.studentIds(), NotificationKind.SCHEDULE_LESSON_PLANNED, (t, language) -> {
            List<String> body = new ArrayList<>();
            group(event.groupId()).ifPresent(name -> body.add(t.group(name)));
            if (event.topic() != null) {
                body.add(t.topic(event.topic()));
            }
            return new Message(t.newLesson(texts.lessonTime(event.startsAt(), language)), join(body));
        });
    }

    @ApplicationModuleListener
    void on(SeriesScheduled event) {
        notifyStudents(event.studentIds(), NotificationKind.SCHEDULE_LESSON_PLANNED, (t, language) -> new Message(
                t.series(texts.weekly(event.weekdays(), event.startTime(), language)),
                group(event.groupId()).map(name -> t.group(name) + " ").orElse("")
                        + t.seriesDates(texts.date(event.startsOn()),
                                event.endsOn() == null ? null : texts.date(event.endsOn()))
                        + (event.intervalWeeks() == 1 ? "" : t.everyWeeks(event.intervalWeeks())) + "."));
    }

    @ApplicationModuleListener
    void on(SeriesStopped event) {
        if (event.replaced()) {
            return;
        }
        notifyStudents(event.studentIds(), NotificationKind.SCHEDULE_LESSON_CANCELLED, (t, language) -> new Message(
                t.seriesStopped(),
                group(event.groupId()).map(name -> t.group(name) + " ").orElse("")
                        + t.seriesStoppedFrom(texts.date(event.from()))));
    }

    @ApplicationModuleListener
    void on(LessonRescheduled event) {
        List<UUID> recipients = event.studentIds().stream()
                .filter(studentId -> !studentId.equals(event.requestedBy()))
                .toList();
        notifyStudents(recipients, NotificationKind.SCHEDULE_LESSON_MOVED, (t, language) -> new Message(
                t.moved(texts.lessonTime(event.startsAt(), language)),
                group(event.groupId()).map(name -> t.group(name) + " ").orElse("")
                        + t.was(texts.lessonTime(event.previousStartsAt(), language))));
    }

    @ApplicationModuleListener
    void on(ScheduledLessonCancelled event) {
        if (event.byRequest()) {
            return;
        }
        notifyStudents(event.studentIds(), NotificationKind.SCHEDULE_LESSON_CANCELLED, (t, language) -> {
            List<String> body = new ArrayList<>();
            group(event.groupId()).ifPresent(name -> body.add(t.group(name)));
            if (event.reason() != null) {
                body.add(t.reason(event.reason()));
            }
            if (event.charged()) {
                body.add(t.countedAsMissed());
            }
            return new Message(t.cancelled(texts.lessonTime(event.startsAt(), language)), join(body));
        });
    }

    /** For the students a deleted planned lesson that has not passed is a cancelled one. */
    @ApplicationModuleListener
    void on(LessonDeleted event) {
        if (!event.planned() || !event.startsAt().isAfter(event.occurredAt())) {
            return;
        }
        notifyStudents(event.studentIds(), NotificationKind.SCHEDULE_LESSON_CANCELLED, (t, language) -> new Message(
                t.cancelled(texts.lessonTime(event.startsAt(), language)),
                group(event.groupId()).map(t::group).orElse(null)));
    }

    @ApplicationModuleListener
    void on(LessonRestored event) {
        if (!event.startsAt().isAfter(event.occurredAt())) {
            return;
        }
        notifyStudents(event.studentIds(), NotificationKind.SCHEDULE_LESSON_PLANNED, (t, language) -> new Message(
                t.restored(texts.lessonTime(event.startsAt(), language)),
                group(event.groupId()).map(name -> t.group(name) + " ").orElse("") + t.cancellationWithdrawn()));
    }

    @ApplicationModuleListener
    void on(LessonChangeRequested event) {
        UUID teacher = users.teacherId();
        Language language = users.language(teacher);
        ScheduleMessages t = ScheduleMessages.of(language);
        String student = name(event.studentId(), t);
        String groupName = group(event.groupId()).orElse(null);
        List<String> body = new ArrayList<>();
        body.add(t.requestedLesson(texts.lessonTime(event.startsAt(), language), groupName));
        if (event.proposedStartsAt() != null) {
            body.add(t.proposes(texts.lessonTime(event.proposedStartsAt(), language)));
        }
        if (event.late()) {
            body.add(groupName == null ? t.lateCancellation() : t.lateAbsence());
        }
        if (event.comment() != null) {
            body.add(t.comment(event.comment()));
        }
        String title;
        if (event.kind() == ChangeKind.RESCHEDULE) {
            title = t.asksToMove(student);
        } else if (groupName != null) {
            title = t.wontCome(student);
        } else {
            title = t.asksToCancel(student);
        }
        ChatSubject subject = event.accepted() ? null
                : new ChatSubject(LessonChangeRequested.CHAT_SUBJECT, event.requestId());
        notifications.notify(teacher, NotificationKind.SCHEDULE_REQUEST, title, join(body), TEACHER_LINK, subject);
    }

    @ApplicationModuleListener
    void on(LessonChangeResolved event) {
        Language language = users.language(event.studentId());
        ScheduleMessages t = ScheduleMessages.of(language);
        String when = texts.lessonTime(event.startsAt(), language);
        boolean absence = event.groupId() != null && event.kind() == ChangeKind.CANCEL;
        String title;
        List<String> body = new ArrayList<>();
        if (!event.approved()) {
            if (event.kind() == ChangeKind.RESCHEDULE) {
                title = t.moveDeclined();
            } else {
                title = absence ? t.absenceDeclined() : t.cancelDeclined();
            }
            body.add(t.lessonStays(when));
        } else if (event.kind() == ChangeKind.RESCHEDULE) {
            title = t.moveAgreed(when);
        } else {
            title = absence ? t.absenceKnown(when) : t.cancelAgreed(when);
            if (event.charged()) {
                body.add(t.lateCharged());
            }
        }
        if (event.comment() != null) {
            body.add(t.teacherComment(event.comment()));
        }
        notifications.notify(event.studentId(), NotificationKind.SCHEDULE_REQUEST_ANSWERED, title, join(body),
                STUDENT_LINK);
    }

    @ApplicationModuleListener
    void on(LessonStartingSoon event) {
        String groupName = group(event.groupId()).orElse(null);
        notifyStudents(event.studentIds(), NotificationKind.SCHEDULE_REMINDER, (t, language) -> {
            List<String> body = new ArrayList<>();
            body.add(t.in(texts.duration(event.before(), language)));
            if (groupName != null) {
                body.add(t.group(groupName));
            }
            if (event.topic() != null) {
                body.add(t.topic(event.topic()) + ".");
            }
            if (event.meetingUrl() != null) {
                body.add(t.meetingLink(event.meetingUrl()));
            }
            return new Message(t.soonForStudent(texts.lessonTime(event.startsAt(), language)), join(body));
        });
        if (event.lastBefore()) {
            UUID teacher = users.teacherId();
            Language language = users.language(teacher);
            ScheduleMessages t = ScheduleMessages.of(language);
            String with = groupName != null ? t.groupOf(groupName)
                    : event.studentIds().isEmpty() ? t.aStudent() : name(event.studentIds().getFirst(), t);
            String in = t.in(texts.duration(event.before(), language));
            notifications.notify(teacher, NotificationKind.SCHEDULE_REMINDER,
                    t.soonForTeacher(with, texts.lessonTime(event.startsAt(), language)),
                    event.meetingUrl() == null ? in : in + " " + t.meetingLink(event.meetingUrl()), TEACHER_LINK);
        }
    }

    @ApplicationModuleListener
    void on(GoogleCalendarDisconnected event) {
        UUID teacher = users.teacherId();
        ScheduleMessages t = ScheduleMessages.of(users.language(teacher));
        notifications.notify(teacher, NotificationKind.SCHEDULE_CALENDAR, t.calendarDisconnected(),
                t.calendarDisconnectedBody(), "/teacher/settings?open=calendar");
    }

    /** Each student gets the message in their language. */
    private void notifyStudents(Collection<UUID> studentIds, NotificationKind kind,
            BiFunction<ScheduleMessages, Language, Message> message) {
        for (UUID studentId : studentIds) {
            Language language = users.language(studentId);
            Message written = message.apply(ScheduleMessages.of(language), language);
            notifications.notify(studentId, kind, written.title(), written.body(), STUDENT_LINK);
        }
    }

    private Optional<String> group(@Nullable UUID groupId) {
        return groupId == null ? Optional.empty() : groups.findGroup(groupId).map(GroupSummary::name);
    }

    private String name(UUID studentId, ScheduleMessages t) {
        return users.findStudent(studentId).map(StudentSummary::displayName).orElse(t.unknownStudent());
    }

    private static @Nullable String join(List<String> parts) {
        return parts.isEmpty() ? null : String.join(" ", parts);
    }
}

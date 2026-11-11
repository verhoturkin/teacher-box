package ru.teacherbox.schedule.notices;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiFunction;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.api.GoogleCalendarDisconnected;
import ru.teacherbox.schedule.api.LessonChangeRequested;
import ru.teacherbox.schedule.api.LessonChangeResolved;
import ru.teacherbox.schedule.api.LessonDeleted;
import ru.teacherbox.schedule.api.LessonRepeatScheduled;
import ru.teacherbox.schedule.api.LessonRepeatStopped;
import ru.teacherbox.schedule.api.LessonRescheduled;
import ru.teacherbox.schedule.api.LessonRestored;
import ru.teacherbox.schedule.api.LessonScheduled;
import ru.teacherbox.schedule.api.LessonStartingSoon;
import ru.teacherbox.schedule.api.LessonSummaryShared;
import ru.teacherbox.schedule.api.ScheduledLessonCancelled;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.notice.NoticeText;

/**
 * The schedule writes its notices (ADR-0061): students learn about new, moved and cancelled lessons
 * (all participants of a group lesson) and the answers to their requests; the teacher gets the
 * students' requests. Both get reminders (the teacher only the last one before a lesson). Every
 * notice is written in each language; {@code notifications} picks the recipient's.
 *
 * <p>The listeners run in the transaction that published the event, so a notice is saved with the
 * change it tells about.
 */
@Component
class ScheduleNotices {

    static final String STUDENT_LINK = "/cabinet/schedule";
    static final String TEACHER_LINK = "/teacher/schedule";

    private final ApplicationEventPublisher events;
    private final ScheduleNoticeFormats formats;
    private final UserDirectory users;
    private final StudentGroups groups;

    ScheduleNotices(ApplicationEventPublisher events, ScheduleNoticeFormats formats, UserDirectory users,
            StudentGroups groups) {
        this.events = events;
        this.formats = formats;
        this.users = users;
        this.groups = groups;
    }

    @EventListener
    void on(LessonScheduled event) {
        notifyStudents(event.studentIds(), ScheduleNoticeKind.SCHEDULE_LESSON_PLANNED, null, (t, language) -> {
            List<String> body = new ArrayList<>();
            group(event.groupId()).ifPresent(name -> body.add(t.group(name)));
            if (event.title() != null) {
                body.add(t.lessonTitle(event.title()));
            }
            if (event.topic() != null) {
                body.add(t.topic(event.topic()) + ".");
            }
            return new NoticeText(t.newLesson(formats.lessonTime(event.startsAt(), language)), join(body));
        });
    }

    @EventListener
    void on(LessonRepeatScheduled event) {
        notifyStudents(event.studentIds(), ScheduleNoticeKind.SCHEDULE_LESSON_PLANNED, null,
                (t, language) -> new NoticeText(
                        t.series(formats.weekly(event.weekdays(), event.startTime(), language)),
                        group(event.groupId()).map(name -> t.group(name) + " ").orElse("")
                                + t.seriesDates(formats.date(event.startsOn()),
                                        event.endsOn() == null ? null : formats.date(event.endsOn()))
                                + (event.intervalWeeks() == 1 ? "" : t.everyWeeks(event.intervalWeeks())) + "."));
    }

    @EventListener
    void on(LessonRepeatStopped event) {
        if (event.replaced()) {
            return;
        }
        notifyStudents(event.studentIds(), ScheduleNoticeKind.SCHEDULE_LESSON_CANCELLED, null,
                (t, language) -> new NoticeText(t.seriesStopped(),
                        group(event.groupId()).map(name -> t.group(name) + " ").orElse("")
                                + t.seriesStoppedFrom(formats.date(event.from()))));
    }

    @EventListener
    void on(LessonRescheduled event) {
        List<UUID> recipients = event.studentIds().stream()
                .filter(studentId -> !studentId.equals(event.requestedBy()))
                .toList();
        notifyStudents(recipients, ScheduleNoticeKind.SCHEDULE_LESSON_MOVED, null, (t, language) -> new NoticeText(
                t.moved(formats.lessonTime(event.startsAt(), language)),
                group(event.groupId()).map(name -> t.group(name) + " ").orElse("")
                        + t.was(formats.lessonTime(event.previousStartsAt(), language))));
    }

    @EventListener
    void on(ScheduledLessonCancelled event) {
        if (event.byRequest()) {
            return;
        }
        notifyStudents(event.studentIds(), ScheduleNoticeKind.SCHEDULE_LESSON_CANCELLED, null, (t, language) -> {
            List<String> body = new ArrayList<>();
            group(event.groupId()).ifPresent(name -> body.add(t.group(name)));
            if (event.reason() != null) {
                body.add(t.reason(event.reason()));
            }
            if (event.charged()) {
                body.add(t.countedAsMissed());
            }
            return new NoticeText(t.cancelled(formats.lessonTime(event.startsAt(), language)), join(body));
        });
    }

    /** For the students a deleted planned lesson that has not passed is a cancelled one. */
    @EventListener
    void on(LessonDeleted event) {
        if (!event.planned() || !event.startsAt().isAfter(event.occurredAt())) {
            return;
        }
        notifyStudents(event.studentIds(), ScheduleNoticeKind.SCHEDULE_LESSON_CANCELLED, null,
                (t, language) -> new NoticeText(t.cancelled(formats.lessonTime(event.startsAt(), language)),
                        group(event.groupId()).map(t::group).orElse(null)));
    }

    @EventListener
    void on(LessonRestored event) {
        if (!event.startsAt().isAfter(event.occurredAt())) {
            return;
        }
        notifyStudents(event.studentIds(), ScheduleNoticeKind.SCHEDULE_LESSON_PLANNED, null,
                (t, language) -> new NoticeText(t.restored(formats.lessonTime(event.startsAt(), language)),
                        group(event.groupId()).map(name -> t.group(name) + " ").orElse("")
                                + t.cancellationWithdrawn()));
    }

    @EventListener
    void on(LessonChangeRequested event) {
        String groupName = group(event.groupId()).orElse(null);
        ChatSubject subject = event.accepted() ? null
                : new ChatSubject(LessonChangeRequested.CHAT_SUBJECT, event.requestId());
        events.publishEvent(NoticeRequested.of(users.teacherId(), ScheduleNoticeKind.SCHEDULE_REQUEST, language -> {
            ScheduleNoticeTexts t = ScheduleNoticeTexts.of(language);
            String student = name(event.studentId(), t);
            List<String> body = new ArrayList<>();
            body.add(t.requestedLesson(formats.lessonTime(event.startsAt(), language), groupName));
            if (event.proposedStartsAt() != null) {
                body.add(t.proposes(formats.lessonTime(event.proposedStartsAt(), language)));
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
            return new NoticeText(title, join(body));
        }, TEACHER_LINK).about(subject));
    }

    @EventListener
    void on(LessonChangeResolved event) {
        boolean absence = event.groupId() != null && event.kind() == ChangeKind.CANCEL;
        events.publishEvent(NoticeRequested.of(event.studentId(), ScheduleNoticeKind.SCHEDULE_REQUEST_ANSWERED,
                language -> {
                    ScheduleNoticeTexts t = ScheduleNoticeTexts.of(language);
                    String when = formats.lessonTime(event.startsAt(), language);
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
                    return new NoticeText(title, join(body));
                }, STUDENT_LINK));
    }

    @EventListener
    void on(LessonStartingSoon event) {
        String groupName = group(event.groupId()).orElse(null);
        String room = event.meetingUrl();
        notifyStudents(event.studentIds(), ScheduleNoticeKind.SCHEDULE_REMINDER, room, (t, language) -> {
            List<String> body = new ArrayList<>();
            body.add(t.in(formats.duration(event.before(), language)));
            if (groupName != null) {
                body.add(t.group(groupName));
            }
            if (event.title() != null) {
                body.add(t.lessonTitle(event.title()));
            }
            if (event.topic() != null) {
                body.add(t.topic(event.topic()) + ".");
            }
            String title = t.soonForStudent(formats.lessonTime(event.startsAt(), language));
            if (room == null) {
                return new NoticeText(title, join(body));
            }
            String withoutAddress = join(body);
            body.add(t.meetingLink(room));
            return new NoticeText(title, join(body), withoutAddress);
        });
        if (event.lastBefore()) {
            events.publishEvent(NoticeRequested.of(users.teacherId(), ScheduleNoticeKind.SCHEDULE_REMINDER,
                    language -> {
                        ScheduleNoticeTexts t = ScheduleNoticeTexts.of(language);
                        String with = groupName != null ? t.groupOf(groupName)
                                : event.studentIds().isEmpty() ? t.aStudent()
                                        : name(event.studentIds().getFirst(), t);
                        String in = t.in(formats.duration(event.before(), language));
                        return new NoticeText(
                                t.soonForTeacher(with, formats.lessonTime(event.startsAt(), language)),
                                room == null ? in : in + " " + t.meetingLink(room), room == null ? null : in);
                    }, TEACHER_LINK).withRoom(room));
        }
    }

    /** The text stays in the lesson card; the message only points to it. */
    @EventListener
    void on(LessonSummaryShared event) {
        for (UUID studentId : event.studentIds()) {
            events.publishEvent(NoticeRequested.of(studentId, ScheduleNoticeKind.LESSON_SUMMARY, language -> {
                ScheduleNoticeTexts t = ScheduleNoticeTexts.of(language);
                return new NoticeText(t.lessonSummary(formats.dayMonth(event.startsAt())), t.lessonSummaryBody());
            }, STUDENT_LINK + "?lesson=" + event.lessonId()));
        }
    }

    @EventListener
    void on(GoogleCalendarDisconnected event) {
        events.publishEvent(NoticeRequested.of(users.teacherId(), ScheduleNoticeKind.SCHEDULE_CALENDAR, language -> {
            ScheduleNoticeTexts t = ScheduleNoticeTexts.of(language);
            return new NoticeText(t.calendarDisconnected(), t.calendarDisconnectedBody());
        }, "/teacher/settings?open=calendar"));
    }

    /** Each student gets the notice, written in every language. */
    private void notifyStudents(Collection<UUID> studentIds, ScheduleNoticeKind kind, @Nullable String room,
            BiFunction<ScheduleNoticeTexts, Language, NoticeText> write) {
        for (UUID studentId : studentIds) {
            events.publishEvent(NoticeRequested.of(studentId, kind,
                    language -> write.apply(ScheduleNoticeTexts.of(language), language), STUDENT_LINK)
                    .withRoom(room));
        }
    }

    private Optional<String> group(@Nullable UUID groupId) {
        return groupId == null ? Optional.empty() : groups.findGroup(groupId).map(GroupSummary::name);
    }

    private String name(UUID studentId, ScheduleNoticeTexts t) {
        return users.findStudent(studentId).map(StudentSummary::displayName).orElse(t.unknownStudent());
    }

    private static @Nullable String join(List<String> parts) {
        return parts.isEmpty() ? null : String.join(" ", parts);
    }
}

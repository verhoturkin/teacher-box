package ru.teacherbox.homework.notices;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.homework.api.HomeworkAssigned;
import ru.teacherbox.homework.api.HomeworkDueSoon;
import ru.teacherbox.homework.api.HomeworkReminderRequested;
import ru.teacherbox.homework.api.HomeworkReviewed;
import ru.teacherbox.homework.api.HomeworkSubmitted;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.notice.NoticeText;
import ru.teacherbox.shared.time.InstanceTimeZone;

/**
 * The homework writes its notices (ADR-0061): to the student — a new task, the deadline, the
 * teacher's reminder and the review; to the teacher — a submission. Every notice is written in each
 * language; {@code notifications} picks the recipient's.
 *
 * <p>The listeners run in the transaction that published the event, so a notice is saved with the
 * change it tells about.
 */
@Component
class HomeworkNotices {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    private final ApplicationEventPublisher events;
    private final UserDirectory users;
    private final InstanceTimeZone timeZone;

    HomeworkNotices(ApplicationEventPublisher events, UserDirectory users, InstanceTimeZone timeZone) {
        this.events = events;
        this.users = users;
        this.timeZone = timeZone;
    }

    @EventListener
    void on(HomeworkAssigned event) {
        notifyStudent(event.studentId(), HomeworkNoticeKind.HOMEWORK_ASSIGNED, event.taskId(),
                t -> new NoticeText(t.taskAssigned(event.title()), due(t, event.dueAt())));
    }

    @EventListener
    void on(HomeworkDueSoon event) {
        notifyStudent(event.studentId(), HomeworkNoticeKind.HOMEWORK_DUE_SOON, event.taskId(),
                t -> new NoticeText(t.dueSoon(event.title()), due(t, event.dueAt())));
    }

    @EventListener
    void on(HomeworkReminderRequested event) {
        notifyStudent(event.studentId(), HomeworkNoticeKind.HOMEWORK_REMINDER, event.taskId(),
                t -> new NoticeText(t.reminder(event.title()), due(t, event.dueAt())));
    }

    @EventListener
    void on(HomeworkReviewed event) {
        notifyStudent(event.studentId(), HomeworkNoticeKind.HOMEWORK_REVIEWED, event.taskId(),
                t -> event.accepted()
                        ? new NoticeText(t.taskAccepted(event.title()),
                                event.grade() == null ? null : t.grade(event.grade()))
                        : new NoticeText(t.taskReturned(event.title()), t.seeTeacherComment()));
    }

    @EventListener
    void on(HomeworkSubmitted event) {
        String student = users.findStudent(event.studentId()).map(StudentSummary::displayName).orElse(null);
        events.publishEvent(NoticeRequested.of(users.teacherId(), HomeworkNoticeKind.HOMEWORK_SUBMITTED, language -> {
            HomeworkNoticeTexts t = HomeworkNoticeTexts.of(language);
            return new NoticeText(t.toReview(event.title()), t.student(student == null ? t.unknownStudent() : student));
        }, "/teacher/homework/tasks/" + event.taskId()));
    }

    private void notifyStudent(UUID studentId, HomeworkNoticeKind kind, UUID taskId,
            Function<HomeworkNoticeTexts, NoticeText> write) {
        events.publishEvent(NoticeRequested.of(studentId, kind,
                language -> write.apply(HomeworkNoticeTexts.of(language)), "/cabinet/homework/" + taskId));
    }

    /** The deadline in the instance time zone; nothing for a task without one. */
    private @Nullable String due(HomeworkNoticeTexts t, @Nullable Instant dueAt) {
        return dueAt == null ? null : t.dueAt(DATE_TIME.format(dueAt.atZone(timeZone.zoneId())));
    }
}

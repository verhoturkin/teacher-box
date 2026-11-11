package ru.teacherbox.identity.notices;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.StudentActivated;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.notice.NoticeText;

/**
 * The accounts write their notices (ADR-0061): the teacher learns that a student accepted the
 * invite. Written in each language; {@code notifications} picks the teacher's.
 *
 * <p>The listener runs in the transaction that published the event.
 */
@Component
class IdentityNotices {

    private final ApplicationEventPublisher events;
    private final UserDirectory users;

    IdentityNotices(ApplicationEventPublisher events, UserDirectory users) {
        this.events = events;
        this.users = users;
    }

    @EventListener
    void on(StudentActivated event) {
        events.publishEvent(NoticeRequested.of(users.teacherId(), IdentityNoticeKind.STUDENT_ACTIVATED, language -> {
            IdentityNoticeTexts t = IdentityNoticeTexts.of(language);
            return new NoticeText(t.studentJoined(), t.studentJoinedBody(event.displayName()));
        }, "/teacher/students"));
    }
}

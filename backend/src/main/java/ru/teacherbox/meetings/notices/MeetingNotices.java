package ru.teacherbox.meetings.notices;

import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.meetings.api.MeetingLinkShared;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.notice.NoticeText;

/**
 * The teacher sent the link of a video room: every recipient gets a notice with it (ADR-0061),
 * written in each language. Messengers show the address as a button, so their text has none.
 *
 * <p>The listener runs in the transaction that published the event.
 */
@Component
class MeetingNotices {

    static final String STUDENT_LINK = "/cabinet/schedule";

    private final ApplicationEventPublisher events;
    private final StudentGroups groups;

    MeetingNotices(ApplicationEventPublisher events, StudentGroups groups) {
        this.events = events;
        this.groups = groups;
    }

    @EventListener
    void on(MeetingLinkShared event) {
        String group = event.groupId() == null ? null
                : groups.findGroup(event.groupId()).map(GroupSummary::name).orElse(null);
        for (UUID studentId : event.studentIds()) {
            events.publishEvent(NoticeRequested.of(studentId, MeetingNoticeKind.MEETING_LINK, language -> {
                MeetingNoticeTexts t = MeetingNoticeTexts.of(language);
                return new NoticeText(t.meetingLink(),
                        group == null ? t.ourLessons(event.joinUrl()) : t.groupLessons(group, event.joinUrl()),
                        group == null ? t.ourRoom() : t.groupRoom(group));
            }, STUDENT_LINK).withRoom(event.joinUrl()));
        }
    }
}

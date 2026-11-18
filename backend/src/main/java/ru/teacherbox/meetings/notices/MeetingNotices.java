package ru.teacherbox.meetings.notices;

import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.meetings.api.CallSummoned;
import ru.teacherbox.meetings.api.MeetingLinkShared;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.notice.NoticeText;

/**
 * The teacher sent the link of a video room: every recipient gets a notice with it (ADR-0061),
 * written in each language. The text holds no address: messengers show the room as a button, the
 * inbox opens the schedule.
 *
 * <p>The listener runs in the transaction that published the event.
 */
@Component
class MeetingNotices {

    static final String STUDENT_LINK = "/cabinet/schedule";
    static final String CALL_LINK = "/call/";

    private final ApplicationEventPublisher events;
    private final StudentGroups groups;

    MeetingNotices(ApplicationEventPublisher events, StudentGroups groups) {
        this.events = events;
        this.groups = groups;
    }

    @EventListener
    void on(MeetingLinkShared event) {
        @Nullable String group = groupName(event.groupId());
        for (UUID studentId : event.studentIds()) {
            events.publishEvent(NoticeRequested.of(studentId, MeetingNoticeKind.MEETING_LINK, language -> {
                MeetingNoticeTexts t = MeetingNoticeTexts.of(language);
                return new NoticeText(t.meetingLink(), group == null ? t.ourRoom() : t.groupRoom(group));
            }, STUDENT_LINK).withRoom(event.joinUrl()));
        }
    }

    /** «Позвать»: the inbox opens the call itself, messengers show it as a button. */
    @EventListener
    void on(CallSummoned event) {
        @Nullable String group = groupName(event.groupId());
        for (UUID studentId : event.studentIds()) {
            events.publishEvent(NoticeRequested.of(studentId, MeetingNoticeKind.CALL_SUMMONED, language -> {
                MeetingNoticeTexts t = MeetingNoticeTexts.of(language);
                return new NoticeText(t.lessonStarted(),
                        group == null ? t.waitingForYou() : t.waitingForYouInGroup(group));
            }, CALL_LINK + event.ownerId()).withRoom(event.joinUrl()));
        }
    }

    private @Nullable String groupName(@Nullable UUID groupId) {
        return groupId == null ? null : groups.findGroup(groupId).map(GroupSummary::name).orElse(null);
    }
}

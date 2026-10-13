package ru.teacherbox.notifications.application;

import ru.teacherbox.identity.api.UserDirectory;
import java.util.UUID;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.meetings.api.MeetingLinkShared;
import ru.teacherbox.notifications.domain.NotificationKind;

/** The teacher sent the link of a video room: every recipient gets it in the inbox and messengers. */
@Component
class MeetingNotifications {

    private final NotificationService notifications;
    private final StudentGroups groups;
    private final UserDirectory users;

    MeetingNotifications(NotificationService notifications, StudentGroups groups, UserDirectory users) {
        this.notifications = notifications;
        this.groups = groups;
        this.users = users;
    }

    @ApplicationModuleListener
    void on(MeetingLinkShared event) {
        String group = event.groupId() == null ? null
                : groups.findGroup(event.groupId()).map(GroupSummary::name).orElse(null);
        for (UUID studentId : event.studentIds()) {
            NotificationMessages t = NotificationMessages.of(users.language(studentId));
            notifications.notify(studentId, NotificationKind.MEETING_LINK, t.meetingLink(),
                    group == null ? t.ourLessons(event.joinUrl()) : t.groupLessons(group, event.joinUrl()),
                    ScheduleNotifications.STUDENT_LINK, null,
                    new JoinLink(event.joinUrl(), group == null ? t.ourRoom() : t.groupRoom(group)));
        }
    }
}

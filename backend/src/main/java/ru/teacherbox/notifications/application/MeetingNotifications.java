package ru.teacherbox.notifications.application;

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

    MeetingNotifications(NotificationService notifications, StudentGroups groups) {
        this.notifications = notifications;
        this.groups = groups;
    }

    @ApplicationModuleListener
    void on(MeetingLinkShared event) {
        String group = event.groupId() == null ? null
                : groups.findGroup(event.groupId()).map(GroupSummary::name).orElse(null);
        String body = (group == null ? "По этой ссылке проходят наши уроки: "
                : "По этой ссылке проходят уроки группы «" + group + "»: ") + event.joinUrl();
        for (UUID studentId : event.studentIds()) {
            notifications.notify(studentId, NotificationKind.MEETING_LINK, "Ссылка на урок", body,
                    ScheduleNotifications.STUDENT_LINK);
        }
    }
}

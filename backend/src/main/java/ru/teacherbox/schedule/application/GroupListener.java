package ru.teacherbox.schedule.application;

import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.GroupArchived;
import ru.teacherbox.identity.api.GroupChanged;

/** Planned lessons of a group follow its members; an archived group has no future lessons (ADR-0011). */
@Component("scheduleGroupListener")
class GroupListener {

    private final ScheduleService schedule;

    GroupListener(ScheduleService schedule) {
        this.schedule = schedule;
    }

    @ApplicationModuleListener
    void on(GroupChanged event) {
        if (!event.addedIds().isEmpty() || !event.removedIds().isEmpty()) {
            schedule.syncGroupMembers(event.groupId(), event.addedIds(), event.removedIds());
        }
    }

    @ApplicationModuleListener
    void on(GroupArchived event) {
        schedule.stopGroup(event.groupId());
    }
}

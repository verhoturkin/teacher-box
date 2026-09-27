package ru.teacherbox.meetings.api;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/** Read-only access to the permanent rooms of students and groups for other modules. */
public interface MeetingRooms {

    /**
     * Join links of the rooms of the given students and groups.
     *
     * @param ownerIds ids of students and groups (they never collide)
     * @return the link of every owner that has a room
     */
    Map<UUID, String> links(Collection<UUID> ownerIds);
}

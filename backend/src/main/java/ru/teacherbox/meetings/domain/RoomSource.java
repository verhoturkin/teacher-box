package ru.teacherbox.meetings.domain;

/** How the room was made. */
public enum RoomSource {
    /** Created through the Telemost API. */
    API,
    /** The teacher entered the link. */
    MANUAL
}

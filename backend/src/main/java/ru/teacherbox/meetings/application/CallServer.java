package ru.teacherbox.meetings.application;

import java.util.List;
import java.util.Map;

/** The media server of the built-in calls (ADR-0030); implemented over LiveKit. */
public interface CallServer {

    /** A user in a room: identity is the user id. */
    record Participant(String identity, String name) {
    }

    /**
     * A permission to join one room.
     *
     * @param admin the teacher: may manage the room
     */
    record Grant(String room, String identity, String name, boolean admin) {
    }

    /** The key and the secret are set. */
    boolean enabled();

    /** A signed token to join the room; does not call the server. */
    String token(Grant grant);

    /**
     * The rooms with someone in them.
     *
     * @return participants by room name
     * @throws CallServerException if the server cannot be reached or refuses the key
     */
    Map<String, List<Participant>> occupiedRooms();

    /** Removes the user from the room if they are there. */
    void removeParticipant(String room, String identity);
}

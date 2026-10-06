package ru.teacherbox.meetings.domain;

import java.util.Optional;
import java.util.UUID;

/** Names of the built-in rooms on the media server: one per student and per group (ADR-0030). */
public final class CallRooms {

    public static final String PREFIX = "tb-";

    private CallRooms() {
    }

    public static String name(UUID ownerId) {
        return PREFIX + ownerId;
    }

    /** The owner of a room of the portal; empty for any other name. */
    public static Optional<UUID> owner(String roomName) {
        if (!roomName.startsWith(PREFIX)) {
            return Optional.empty();
        }
        try {
            return Optional.of(UUID.fromString(roomName.substring(PREFIX.length())));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}

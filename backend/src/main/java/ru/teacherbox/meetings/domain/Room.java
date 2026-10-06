package ru.teacherbox.meetings.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * The external call link of a student or a group (ADR-0030): it wins over their built-in room.
 */
public record Room(UUID id, RoomOwner ownerType, UUID ownerId, String joinUrl, Instant createdAt, Instant updatedAt,
        long version) {

    public Room {
        Objects.requireNonNull(id);
        Objects.requireNonNull(ownerType);
        Objects.requireNonNull(ownerId);
        joinUrl = MeetingLinks.valid(joinUrl);
    }

    /** A link the teacher entered. */
    public static Room entered(UUID id, RoomOwner ownerType, UUID ownerId, String joinUrl, Instant now) {
        return new Room(id, ownerType, ownerId, joinUrl, now, now, 0);
    }

    /** The same room with another link. */
    public Room withLink(String link, Instant now) {
        return new Room(id, ownerType, ownerId, link, createdAt, now, version);
    }

    public boolean isTelemost() {
        return MeetingLinks.isTelemost(joinUrl);
    }
}

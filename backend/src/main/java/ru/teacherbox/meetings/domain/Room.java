package ru.teacherbox.meetings.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * The permanent video room of a student or a group: one link for all their lessons.
 *
 * @param conferenceId id of the Telemost meeting for a room created through the API
 */
public record Room(UUID id, RoomOwner ownerType, UUID ownerId, String joinUrl, @Nullable String conferenceId,
        RoomSource source, Instant createdAt, Instant updatedAt, long version) {

    public Room {
        Objects.requireNonNull(id);
        Objects.requireNonNull(ownerType);
        Objects.requireNonNull(ownerId);
        Objects.requireNonNull(source);
        joinUrl = MeetingLinks.valid(joinUrl);
    }

    /** A room created through the Telemost API. */
    public static Room created(UUID id, RoomOwner ownerType, UUID ownerId, String joinUrl, String conferenceId,
            Instant now) {
        return new Room(id, ownerType, ownerId, joinUrl, conferenceId, RoomSource.API, now, now, 0);
    }

    /** A room with a link the teacher entered. */
    public static Room entered(UUID id, RoomOwner ownerType, UUID ownerId, String joinUrl, Instant now) {
        return new Room(id, ownerType, ownerId, joinUrl, null, RoomSource.MANUAL, now, now, 0);
    }

    /** The same room with another meeting (a new one from the API or an entered link). */
    public Room replacedBy(Room other, Instant now) {
        return new Room(id, ownerType, ownerId, other.joinUrl(), other.conferenceId(), other.source(), createdAt, now,
                version);
    }

    public boolean isTelemost() {
        return MeetingLinks.isTelemost(joinUrl);
    }
}

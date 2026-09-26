package ru.teacherbox.identity.api;

import java.time.Instant;
import java.util.UUID;

/** The teacher archived a group: it has no future lessons any more. */
public record GroupArchived(UUID groupId, Instant occurredAt) {
}

package ru.teacherbox.identity.api;

import java.time.Instant;
import java.util.UUID;

/** The teacher added a guardian from a student's card (status {@link StudentStatus#INVITED}); a {@link GuardianLinked} follows. */
public record GuardianRegistered(UUID guardianId, String displayName, Instant occurredAt) {
}

package ru.teacherbox.identity.api;

import java.time.Instant;
import java.util.UUID;

/**
 * The teacher removed the guardian from the student's card.
 *
 * @param deactivated the student was the guardian's last child: the guardian's account is deactivated
 */
public record GuardianUnlinked(UUID guardianId, UUID studentId, boolean deactivated, Instant occurredAt) {
}

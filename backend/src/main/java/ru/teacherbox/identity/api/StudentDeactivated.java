package ru.teacherbox.identity.api;

import java.time.Instant;
import java.util.UUID;

/** The teacher revoked the student's access. */
public record StudentDeactivated(UUID studentId, Instant occurredAt) {
}

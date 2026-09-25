package ru.teacherbox.identity.api;

import java.time.Instant;
import java.util.UUID;

/** The teacher restored access of a previously deactivated student. */
public record StudentReactivated(UUID studentId, StudentStatus status, Instant occurredAt) {
}

package ru.teacherbox.identity.api;

import java.time.Instant;
import java.util.UUID;

/** The guardian became a guardian of the student: a new guardian or an existing one (a sibling). */
public record GuardianLinked(UUID guardianId, UUID studentId, Instant occurredAt) {
}

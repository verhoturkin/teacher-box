package ru.teacherbox.identity.api;

import java.time.Instant;
import java.util.UUID;

/** The student accepted the invitation and set up credentials. */
public record StudentActivated(UUID studentId, String displayName, Instant occurredAt) {
}

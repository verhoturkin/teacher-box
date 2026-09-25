package ru.teacherbox.identity.api;

import java.time.Instant;
import java.util.UUID;

/** The teacher added a student (status {@link StudentStatus#INVITED}). */
public record StudentRegistered(UUID studentId, String displayName, Instant occurredAt) {
}

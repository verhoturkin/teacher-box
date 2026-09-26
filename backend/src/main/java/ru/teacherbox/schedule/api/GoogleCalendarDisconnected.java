package ru.teacherbox.schedule.api;

import java.time.Instant;

/**
 * Google stopped accepting the portal's access to the teacher's calendar (revoked or expired);
 * lessons are not synced until the teacher connects the calendar again.
 */
public record GoogleCalendarDisconnected(String reason, Instant occurredAt) {
}

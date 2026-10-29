package ru.teacherbox.schedule.api;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Reminder: a lesson starts soon.
 *
 * @param groupId    the group of a group lesson, {@code null} for a lesson with one student
 * @param studentIds participants who are expected at the lesson (excused ones are left out)
 * @param title      the lesson's name; {@code null} means the default (the student's or the group's name)
 * @param topic      what the lesson covers
 * @param before     how long before the start the reminder is sent
 * @param lastBefore this is the last reminder before the lesson (the teacher gets only this one)
 */
public record LessonStartingSoon(
        UUID lessonId,
        @Nullable UUID groupId,
        List<UUID> studentIds,
        Instant startsAt,
        int durationMinutes,
        @Nullable String title,
        @Nullable String topic,
        @Nullable String meetingUrl,
        Duration before,
        boolean lastBefore,
        Instant occurredAt) {

    public LessonStartingSoon {
        studentIds = List.copyOf(studentIds);
    }
}

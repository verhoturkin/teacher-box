package ru.teacherbox.schedule.application;

import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.Series;

/**
 * Names of the students and groups that lessons refer to and the students' photos (they live in identity),
 * the links of their permanent rooms (they live in meetings).
 *
 * @param avatars addresses of the photos of the students who have one
 */
public record ScheduleNames(Map<UUID, String> students, Map<UUID, String> groups, Map<UUID, String> rooms,
        Map<UUID, String> avatars) {

    public ScheduleNames {
        students = Map.copyOf(students);
        groups = Map.copyOf(groups);
        rooms = Map.copyOf(rooms);
        avatars = Map.copyOf(avatars);
    }

    /** Names without room links and photos. */
    public ScheduleNames(Map<UUID, String> students, Map<UUID, String> groups) {
        this(students, groups, Map.of(), Map.of());
    }

    /** The same names with the links of the rooms. */
    public ScheduleNames withRooms(Map<UUID, String> links) {
        return new ScheduleNames(students, groups, links, avatars);
    }

    /** Where the lesson takes place: its own link, or the room of the group or the student. */
    public @Nullable String joinUrl(Lesson lesson) {
        if (lesson.meetingUrl() != null) {
            return lesson.meetingUrl();
        }
        return rooms.get(lesson.isGroup() ? lesson.groupId() : lesson.studentId());
    }

    public @Nullable String student(UUID studentId) {
        return students.get(studentId);
    }

    /** The address of the student's photo; {@code null}: none. */
    public @Nullable String avatar(@Nullable UUID studentId) {
        return studentId == null ? null : avatars.get(studentId);
    }

    public @Nullable String group(@Nullable UUID groupId) {
        return groupId == null ? null : groups.get(groupId);
    }

    /** Who the lesson is with: the name of the group or of the student. */
    public @Nullable String title(Lesson lesson) {
        return lesson.isGroup() ? group(lesson.groupId()) : student(lesson.studentId());
    }

    /** Who the series is with: the name of the group or of the student. */
    public @Nullable String title(Series series) {
        UUID studentId = series.studentId();
        return studentId == null ? group(series.groupId()) : student(studentId);
    }
}

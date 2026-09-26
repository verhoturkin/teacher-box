package ru.teacherbox.schedule.application;

import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.Series;

/** Names of the students and groups that lessons refer to (they live in identity). */
public record ScheduleNames(Map<UUID, String> students, Map<UUID, String> groups) {

    public ScheduleNames {
        students = Map.copyOf(students);
        groups = Map.copyOf(groups);
    }

    public @Nullable String student(UUID studentId) {
        return students.get(studentId);
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

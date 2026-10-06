package ru.teacherbox.schedule.application;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.meetings.api.MeetingRooms;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.Series;
import ru.teacherbox.shared.error.NotFoundException;

/** Students and groups of identity as the schedule needs them: names and checks. */
@Component
public class ScheduleDirectory {

    private final UserDirectory users;
    private final StudentGroups groups;
    private final MeetingRooms rooms;

    public ScheduleDirectory(UserDirectory users, StudentGroups groups, MeetingRooms rooms) {
        this.users = users;
        this.groups = groups;
        this.rooms = rooms;
    }

    /** Names for the participants and groups of the lessons and the links of their rooms. */
    public ScheduleNames namesOf(Collection<Lesson> lessons) {
        Set<UUID> students = new HashSet<>();
        Set<UUID> groupIds = new HashSet<>();
        Set<UUID> owners = new HashSet<>();
        for (Lesson lesson : lessons) {
            students.addAll(lesson.studentIds());
            UUID groupId = lesson.groupId();
            if (groupId != null) {
                groupIds.add(groupId);
                owners.add(groupId);
            } else {
                owners.add(lesson.studentId());
            }
        }
        ScheduleNames names = names(students, groupIds);
        return owners.isEmpty() ? names : names.withRooms(rooms.links(owners));
    }

    /** Names for the students and groups of the series. */
    public ScheduleNames namesOfSeries(Collection<Series> series) {
        return names(series.stream().map(Series::studentId).filter(Objects::nonNull).collect(Collectors.toSet()),
                series.stream().map(Series::groupId).filter(Objects::nonNull).collect(Collectors.toSet()));
    }

    public ScheduleNames names(Collection<UUID> studentIds, Collection<UUID> groupIds) {
        List<StudentSummary> students = users.findStudents(Set.copyOf(studentIds));
        Map<UUID, String> avatars = new HashMap<>();
        for (StudentSummary student : students) {
            String avatar = student.avatar();
            if (avatar != null) {
                avatars.put(student.id(), avatar);
            }
        }
        return new ScheduleNames(
                students.stream().collect(Collectors.toMap(StudentSummary::id, StudentSummary::displayName)),
                groups.findGroups(Set.copyOf(groupIds)).stream()
                        .collect(Collectors.toMap(GroupSummary::id, GroupSummary::name)),
                Map.of(), avatars);
    }

    /** A student who can get lessons (not deactivated). */
    public StudentSummary currentStudent(UUID studentId) {
        return users.findStudent(studentId)
                .filter(StudentSummary::isCurrent)
                .orElseThrow(() -> new NotFoundException("schedule.student-not-found", "Student not found"));
    }

    /** A group that can get lessons (not archived). */
    public GroupSummary currentGroup(UUID groupId) {
        return groups.findGroup(groupId)
                .filter(group -> !group.archived())
                .orElseThrow(() -> new NotFoundException("schedule.group-not-found", "Group not found"));
    }

    /** The current members of a group in their order, or none for an archived or unknown group. */
    public List<UUID> membersOf(UUID groupId) {
        return groups.findGroup(groupId)
                .filter(group -> !group.archived())
                .map(GroupSummary::memberIds)
                .orElse(List.of());
    }

    public UUID teacherId() {
        return users.teacherId();
    }

    public boolean isCurrentStudent(UUID studentId) {
        return users.isCurrentStudent(studentId);
    }
}

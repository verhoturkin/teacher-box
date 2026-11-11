package ru.teacherbox.testing.notices;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.i18n.Language;

/**
 * The people of the notice samples, with fixed ids: a teacher, three students and a group. Everybody
 * reads in {@link #language}.
 */
public final class SamplePeople implements UserDirectory, StudentGroups {

    public static final UUID TEACHER = id(1);
    public static final UUID ANNA = id(11);
    public static final UUID BORIS = id(12);
    public static final UUID VERA = id(13);
    /** A student the directory does not know. */
    public static final UUID STRANGER = id(19);
    public static final UUID GROUP = id(21);
    /** A group the directory does not know. */
    public static final UUID LOST_GROUP = id(29);

    private static final Map<UUID, String> STUDENTS = new LinkedHashMap<>();

    static {
        STUDENTS.put(ANNA, "Анна Иванова");
        STUDENTS.put(BORIS, "Борис");
        STUDENTS.put(VERA, "Vera Smith");
    }

    private Language language = Language.RU;

    public static UUID id(long number) {
        return new UUID(0, number);
    }

    /** Whom a notice goes to, for the golden file. */
    public static String name(UUID id) {
        if (TEACHER.equals(id)) {
            return "teacher";
        }
        return Objects.requireNonNull(STUDENTS.get(id), () -> "Not a sample person: " + id);
    }

    public void read(Language language) {
        this.language = language;
    }

    @Override
    public UUID teacherId() {
        return TEACHER;
    }

    @Override
    public Optional<StudentSummary> findStudent(UUID studentId) {
        return Optional.ofNullable(STUDENTS.get(studentId))
                .map(name -> new StudentSummary(studentId, name, StudentStatus.ACTIVE));
    }

    @Override
    public List<StudentSummary> findStudents(Collection<UUID> studentIds) {
        return studentIds.stream().map(this::findStudent).flatMap(Optional::stream).toList();
    }

    @Override
    public List<StudentSummary> currentStudents() {
        return findStudents(STUDENTS.keySet());
    }

    @Override
    public Language language(UUID userId) {
        return language;
    }

    @Override
    public Optional<GroupSummary> findGroup(UUID groupId) {
        return GROUP.equals(groupId) ? Optional.of(new GroupSummary(GROUP, "ОГЭ", List.of(ANNA, BORIS), false))
                : Optional.empty();
    }

    @Override
    public List<GroupSummary> findGroups(Collection<UUID> groupIds) {
        return groupIds.stream().map(this::findGroup).flatMap(Optional::stream).toList();
    }

    @Override
    public List<GroupSummary> groupsOf(UUID studentId) {
        return findGroup(GROUP).filter(group -> group.memberIds().contains(studentId)).stream().toList();
    }

    @Override
    public List<GroupSummary> currentGroups() {
        return findGroup(GROUP).stream().toList();
    }
}

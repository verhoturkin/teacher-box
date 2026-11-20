package ru.teacherbox.testing;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.textbooks.api.CourseSummary;
import ru.teacherbox.textbooks.api.Courses;

/** In-memory {@link Courses} for module tests that do not bootstrap textbooks; no current courses. */
public class FakeCourses implements Courses {

    private final Map<UUID, CourseSummary> courses = new ConcurrentHashMap<>();

    public UUID add(String name) {
        UUID id = Ids.newId();
        courses.put(id, new CourseSummary(id, name));
        return id;
    }

    public void remove(UUID id) {
        courses.remove(id);
    }

    @Override
    public Optional<CourseSummary> find(UUID courseId) {
        return Optional.ofNullable(courses.get(courseId));
    }

    @Override
    public List<CourseSummary> find(Collection<UUID> courseIds) {
        return courseIds.stream().map(courses::get).filter(Objects::nonNull).toList();
    }

    @Override
    public Optional<CourseSummary> ofStudent(UUID studentId) {
        return Optional.empty();
    }

    @Override
    public Optional<CourseSummary> ofGroup(UUID groupId) {
        return Optional.empty();
    }
}

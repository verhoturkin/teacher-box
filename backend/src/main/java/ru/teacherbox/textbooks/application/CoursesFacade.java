package ru.teacherbox.textbooks.application;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.textbooks.api.CourseSummary;
import ru.teacherbox.textbooks.api.Courses;
import ru.teacherbox.textbooks.domain.Course;
import ru.teacherbox.textbooks.persistence.CourseRepository;

/** Courses for other modules: read only (ADR-0071). */
@Service
class CoursesFacade implements Courses {

    private final CourseRepository courses;
    private final CourseService service;

    CoursesFacade(CourseRepository courses, CourseService service) {
        this.courses = courses;
        this.service = service;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CourseSummary> find(UUID courseId) {
        return courses.findById(courseId).map(CoursesFacade::summary);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CourseSummary> find(Collection<UUID> courseIds) {
        return courses.findByIds(Set.copyOf(courseIds)).stream().map(CoursesFacade::summary).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CourseSummary> ofStudent(UUID studentId) {
        return service.ofStudent(studentId).map(CoursesFacade::summary);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CourseSummary> ofGroup(UUID groupId) {
        return service.ofGroup(groupId).map(CoursesFacade::summary);
    }

    private static CourseSummary summary(Course course) {
        return new CourseSummary(course.id(), course.name());
    }
}

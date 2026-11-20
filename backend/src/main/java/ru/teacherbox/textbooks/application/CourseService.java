package ru.teacherbox.textbooks.application;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.textbooks.api.CourseDeleted;
import ru.teacherbox.textbooks.domain.Course;
import ru.teacherbox.textbooks.persistence.CourseRepository;

/** Courses and the current courses of students and groups (ADR-0071). */
@Service
public class CourseService {

    /** A course of the teacher's list. */
    public record CourseView(UUID id, String name, int position, long version) {

        static CourseView of(Course course) {
            return new CourseView(course.id(), course.name(), course.position(), course.version());
        }
    }

    public record StudentCourse(UUID studentId, UUID courseId) {
    }

    public record GroupCourse(UUID groupId, UUID courseId) {
    }

    /** Every current course of a student and of a group. */
    public record CourseLinks(List<StudentCourse> students, List<GroupCourse> groups) {
    }

    private final CourseRepository courses;
    private final UserDirectory users;
    private final StudentGroups groups;
    private final ApplicationEventPublisher events;

    public CourseService(CourseRepository courses, UserDirectory users, StudentGroups groups,
            ApplicationEventPublisher events) {
        this.courses = courses;
        this.users = users;
        this.groups = groups;
        this.events = events;
    }

    /** In the teacher's order. */
    @Transactional(readOnly = true)
    public List<CourseView> list() {
        return courses.findAll().stream().map(CourseView::of).toList();
    }

    /** @throws ConflictException {@code textbooks.course-exists} if a course has the name, ignoring case */
    @Transactional
    public CourseView create(String name) {
        Course course = new Course(Ids.newId(), name, 0, 0);
        requireFree(course);
        return CourseView.of(courses.insert(course));
    }

    /**
     * @throws ConflictException {@code textbooks.course-exists} if another course has the name, ignoring case
     * @throws OptimisticLockingFailureException if the course was changed after {@code expectedVersion}
     */
    @Transactional
    public CourseView rename(UUID courseId, String name, long expectedVersion) {
        Course course = find(courseId);
        if (course.version() != expectedVersion) {
            throw new OptimisticLockingFailureException("Course " + courseId + " was modified");
        }
        Course renamed = course.renamed(name);
        requireFree(renamed);
        return CourseView.of(courses.update(renamed));
    }

    /**
     * Deletes the course: its textbooks, students and groups are left without a course, the textbooks shared
     * with its students lose that member; other modules hear {@link CourseDeleted}.
     */
    @Transactional
    public void remove(UUID courseId) {
        find(courseId);
        courses.delete(courseId);
        events.publishEvent(new CourseDeleted(courseId));
    }

    /**
     * Sets a student's current course; {@code null} — none. A course is given only to a current student.
     *
     * @throws NotFoundException {@code textbooks.student-not-found}, {@code textbooks.course-not-found}
     */
    @Transactional
    public void setStudentCourse(UUID studentId, @Nullable UUID courseId) {
        Optional<StudentSummary> student = users.findStudent(studentId);
        if (student.isEmpty() || courseId != null && !student.get().isCurrent()) {
            throw new NotFoundException("textbooks.student-not-found", "Student not found");
        }
        if (courseId != null) {
            find(courseId);
        }
        courses.setStudentCourse(studentId, courseId);
    }

    /**
     * Sets a group's current course; {@code null} — none. A course is given only to an active group.
     *
     * @throws NotFoundException {@code textbooks.group-not-found}, {@code textbooks.course-not-found}
     */
    @Transactional
    public void setGroupCourse(UUID groupId, @Nullable UUID courseId) {
        Optional<GroupSummary> group = groups.findGroup(groupId);
        if (group.isEmpty() || courseId != null && group.get().archived()) {
            throw new NotFoundException("textbooks.group-not-found", "Group not found");
        }
        if (courseId != null) {
            find(courseId);
        }
        courses.setGroupCourse(groupId, courseId);
    }

    @Transactional(readOnly = true)
    public CourseLinks links() {
        return new CourseLinks(
                courses.studentLinks().stream().map(link -> new StudentCourse(link.ownerId(), link.courseId()))
                        .toList(),
                courses.groupLinks().stream().map(link -> new GroupCourse(link.ownerId(), link.courseId())).toList());
    }

    /** The course, or 404 {@code textbooks.course-not-found}. */
    Course find(UUID courseId) {
        return courses.findById(courseId).orElseThrow(CourseService::notFound);
    }

    /** All of them must exist, or 404 {@code textbooks.course-not-found}. */
    void requireAll(Collection<UUID> courseIds) {
        Set<UUID> wanted = new LinkedHashSet<>(courseIds);
        if (courses.findByIds(wanted).size() != wanted.size()) {
            throw notFound();
        }
    }

    /** The names of the given courses by id; deleted ones are missing. */
    Map<UUID, String> names(Collection<UUID> courseIds) {
        return courses.findByIds(Set.copyOf(courseIds)).stream()
                .collect(Collectors.toMap(Course::id, Course::name));
    }

    Optional<Course> ofStudent(UUID studentId) {
        return courses.courseOfStudent(studentId).flatMap(courses::findById);
    }

    Optional<Course> ofGroup(UUID groupId) {
        return courses.courseOfGroup(groupId).flatMap(courses::findById);
    }

    /** The student's current course and those of their current groups. */
    Set<UUID> coursesOf(UUID studentId, Collection<UUID> currentGroupIds) {
        Set<UUID> ids = new LinkedHashSet<>(courses.coursesOfGroups(currentGroupIds));
        courses.courseOfStudent(studentId).ifPresent(ids::add);
        return ids;
    }

    static NotFoundException notFound() {
        return new NotFoundException("textbooks.course-not-found", "Course not found");
    }

    private void requireFree(Course course) {
        if (courses.nameTaken(course.name(), course.id())) {
            throw new ConflictException("textbooks.course-exists", "A course with this name exists");
        }
    }
}

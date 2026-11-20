package ru.teacherbox.textbooks.api;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Read-only access to courses for other modules (ADR-0071); a deleted course publishes {@link CourseDeleted}. */
public interface Courses {

    Optional<CourseSummary> find(UUID courseId);

    /** Summaries of the given courses; deleted ones are skipped. */
    List<CourseSummary> find(Collection<UUID> courseIds);

    /** The current course of a student, if any. */
    Optional<CourseSummary> ofStudent(UUID studentId);

    /** The current course of a group, if any. */
    Optional<CourseSummary> ofGroup(UUID groupId);
}

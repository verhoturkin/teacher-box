package ru.teacherbox.homework.application;

import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.homework.persistence.AssignmentRepository;
import ru.teacherbox.textbooks.api.CourseDeleted;

/** A deleted course leaves its assignments without one (ADR-0071); a redelivery changes nothing. */
@Component
class CourseListener {

    private final AssignmentRepository assignments;

    CourseListener(AssignmentRepository assignments) {
        this.assignments = assignments;
    }

    @ApplicationModuleListener
    void on(CourseDeleted event) {
        assignments.clearCourse(event.courseId());
    }
}

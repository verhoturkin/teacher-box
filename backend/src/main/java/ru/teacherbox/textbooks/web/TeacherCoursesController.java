package ru.teacherbox.textbooks.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.textbooks.application.CourseService;
import ru.teacherbox.textbooks.application.CourseService.CourseLinks;
import ru.teacherbox.textbooks.application.CourseService.CourseView;
import ru.teacherbox.textbooks.domain.Course;

/** The teacher's courses and the current courses of students and groups (ADR-0071). */
@RestController
@RequestMapping("/api/teacher/textbooks")
class TeacherCoursesController {

    record CreateRequest(@NotBlank @Size(max = Course.MAX_NAME) String name) {
    }

    record RenameRequest(@NotBlank @Size(max = Course.MAX_NAME) String name, @NotNull Long version) {
    }

    /** @param courseId {@code null} — no course */
    record LinkRequest(@Nullable UUID courseId) {
    }

    private final CourseService courses;

    TeacherCoursesController(CourseService courses) {
        this.courses = courses;
    }

    /** In the teacher's order. */
    @GetMapping("/courses")
    List<CourseView> list() {
        return courses.list();
    }

    /** A name taken ignoring case — 409 {@code textbooks.course-exists}. */
    @PostMapping("/courses")
    @ResponseStatus(HttpStatus.CREATED)
    CourseView create(@Valid @RequestBody CreateRequest request) {
        return courses.create(request.name());
    }

    @PutMapping("/courses/{id}")
    CourseView rename(@PathVariable UUID id, @Valid @RequestBody RenameRequest request) {
        return courses.rename(id, request.name(), request.version());
    }

    /** Its textbooks, students and groups are left without a course. */
    @DeleteMapping("/courses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void remove(@PathVariable UUID id) {
        courses.remove(id);
    }

    @PutMapping("/students/{studentId}/course")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void studentCourse(@PathVariable UUID studentId, @RequestBody LinkRequest request) {
        courses.setStudentCourse(studentId, request.courseId());
    }

    @PutMapping("/groups/{groupId}/course")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void groupCourse(@PathVariable UUID groupId, @RequestBody LinkRequest request) {
        courses.setGroupCourse(groupId, request.courseId());
    }

    /** Every current course of a student and of a group. */
    @GetMapping("/course-links")
    CourseLinks links() {
        return courses.links();
    }
}

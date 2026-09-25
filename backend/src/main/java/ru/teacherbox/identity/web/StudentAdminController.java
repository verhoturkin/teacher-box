package ru.teacherbox.identity.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.identity.application.IssuedInvite;
import ru.teacherbox.identity.application.StudentAdminService;
import ru.teacherbox.identity.application.StudentView;
import ru.teacherbox.identity.domain.Profile;

/** Student management; the whole {@code /api/teacher/**} area requires the teacher role. */
@RestController
@RequestMapping("/api/teacher/students")
class StudentAdminController {

    record StudentRequest(
            @NotBlank @Size(max = 100) String displayName,
            @Size(max = 254) @Nullable String email,
            @Size(max = 32) @Nullable String phone,
            @Size(max = 2000) @Nullable String note) {

        Profile profile() {
            return new Profile(displayName, email, phone, note);
        }
    }

    record UpdateStudentRequest(
            @NotBlank @Size(max = 100) String displayName,
            @Size(max = 254) @Nullable String email,
            @Size(max = 32) @Nullable String phone,
            @Size(max = 2000) @Nullable String note,
            @NotNull Long version) {

        Profile profile() {
            return new Profile(displayName, email, phone, note);
        }
    }

    private final StudentAdminService students;

    StudentAdminController(StudentAdminService students) {
        this.students = students;
    }

    @GetMapping
    List<StudentView> list() {
        return students.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    StudentAdminService.CreatedStudent create(@Valid @RequestBody StudentRequest request) {
        return students.create(request.profile());
    }

    @GetMapping("/{id}")
    StudentView get(@PathVariable UUID id) {
        return students.get(id);
    }

    @PutMapping("/{id}")
    StudentView update(@PathVariable UUID id, @Valid @RequestBody UpdateStudentRequest request) {
        return students.update(id, request.profile(), request.version());
    }

    @PostMapping("/{id}/invite")
    IssuedInvite reissueInvite(@PathVariable UUID id) {
        return students.reissueInvite(id);
    }

    @PostMapping("/{id}/deactivate")
    StudentView deactivate(@PathVariable UUID id) {
        return students.deactivate(id);
    }

    @PostMapping("/{id}/reactivate")
    StudentView reactivate(@PathVariable UUID id) {
        return students.reactivate(id);
    }
}

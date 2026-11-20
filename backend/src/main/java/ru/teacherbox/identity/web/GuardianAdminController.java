package ru.teacherbox.identity.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.identity.application.GuardianAdminService;
import ru.teacherbox.identity.application.GuardianView;
import ru.teacherbox.identity.application.IssuedInvite;
import ru.teacherbox.identity.domain.Profile;

/** Guardians (parents) of students, managed by the teacher (ADR-0069); {@code /api/teacher/**} is the teacher's. */
@RestController
class GuardianAdminController {

    record GuardianRequest(@NotBlank @Size(max = Profile.MAX_NAME_LENGTH) String displayName) {
    }

    record LinkRequest(@NotNull UUID guardianId) {
    }

    private final GuardianAdminService guardians;

    GuardianAdminController(GuardianAdminService guardians) {
        this.guardians = guardians;
    }

    @GetMapping("/api/teacher/students/{id}/guardians")
    List<GuardianView> list(@PathVariable UUID id) {
        return guardians.list(id);
    }

    @PostMapping("/api/teacher/students/{id}/guardians")
    @ResponseStatus(HttpStatus.CREATED)
    GuardianAdminService.CreatedGuardian create(@PathVariable UUID id, @Valid @RequestBody GuardianRequest request) {
        return guardians.create(id, Profile.named(request.displayName()));
    }

    @PostMapping("/api/teacher/students/{id}/guardians/link")
    GuardianView link(@PathVariable UUID id, @Valid @RequestBody LinkRequest request) {
        return guardians.link(id, request.guardianId());
    }

    @PostMapping("/api/teacher/students/{id}/guardians/{guardianId}/invite")
    IssuedInvite reissueInvite(@PathVariable UUID id, @PathVariable UUID guardianId) {
        return guardians.reissueInvite(id, guardianId);
    }

    @DeleteMapping("/api/teacher/students/{id}/guardians/{guardianId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void unlink(@PathVariable UUID id, @PathVariable UUID guardianId) {
        guardians.unlink(id, guardianId);
    }

    /** Every guardian of the instance: «link an existing parent» picks one of them. */
    @GetMapping("/api/teacher/guardians")
    List<GuardianView> all() {
        return guardians.all();
    }
}

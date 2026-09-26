package ru.teacherbox.identity.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.identity.application.GroupService;
import ru.teacherbox.identity.application.GroupView;
import ru.teacherbox.identity.domain.StudentGroup;

/** Groups of students; the whole {@code /api/teacher/**} area requires the teacher role. */
@RestController
@RequestMapping("/api/teacher/groups")
class GroupController {

    record GroupRequest(
            @NotBlank @Size(max = StudentGroup.MAX_NAME_LENGTH) String name,
            @NotNull @Size(max = StudentGroup.MAX_MEMBERS) List<@NotNull UUID> memberIds) {
    }

    record UpdateGroupRequest(
            @NotBlank @Size(max = StudentGroup.MAX_NAME_LENGTH) String name,
            @NotNull @Size(max = StudentGroup.MAX_MEMBERS) List<@NotNull UUID> memberIds,
            @NotNull Long version) {
    }

    private final GroupService groups;

    GroupController(GroupService groups) {
        this.groups = groups;
    }

    @GetMapping
    List<GroupView> list() {
        return groups.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    GroupView create(@Valid @RequestBody GroupRequest request) {
        return groups.create(request.name(), request.memberIds());
    }

    @GetMapping("/{id}")
    GroupView get(@PathVariable UUID id) {
        return groups.get(id);
    }

    @PutMapping("/{id}")
    GroupView update(@PathVariable UUID id, @Valid @RequestBody UpdateGroupRequest request) {
        return groups.update(id, request.name(), request.memberIds(), request.version());
    }

    @PostMapping("/{id}/archive")
    GroupView archive(@PathVariable UUID id) {
        return groups.archive(id);
    }

    @PostMapping("/{id}/restore")
    GroupView restore(@PathVariable UUID id) {
        return groups.unarchive(id);
    }
}

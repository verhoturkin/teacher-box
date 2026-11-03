package ru.teacherbox.identity.web;

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
import ru.teacherbox.identity.application.StudentTagService;
import ru.teacherbox.identity.application.StudentTagService.Changed;
import ru.teacherbox.identity.application.StudentTagService.ValueInput;
import ru.teacherbox.identity.domain.Tag;

/** Student tags (ADR-0055); the whole {@code /api/teacher/**} area requires the teacher role. */
@RestController
@RequestMapping("/api/teacher/tags")
class TagController {

    record CreateTagRequest(
            @NotBlank @Size(max = Tag.MAX_NAME_LENGTH) String name,
            @NotNull Boolean useInAi,
            @NotNull @Size(min = 1, max = Tag.MAX_VALUES) List<@NotBlank @Size(max = Tag.MAX_LABEL_LENGTH) String> values) {
    }

    record ValueRequest(@Nullable UUID id, @NotBlank @Size(max = Tag.MAX_LABEL_LENGTH) String label) {
    }

    record UpdateTagRequest(
            @NotBlank @Size(max = Tag.MAX_NAME_LENGTH) String name,
            @NotNull Boolean useInAi,
            @NotNull @Size(min = 1, max = Tag.MAX_VALUES) List<@NotNull @Valid ValueRequest> values,
            @NotNull Long version) {
    }

    record OrderRequest(@NotNull @Size(max = Tag.MAX_TAGS) List<@NotNull UUID> ids) {
    }

    record Cleared(int clearedStudents) {
    }

    private final StudentTagService tags;

    TagController(StudentTagService tags) {
        this.tags = tags;
    }

    @GetMapping
    List<Tag> list() {
        return tags.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    Tag create(@Valid @RequestBody CreateTagRequest request) {
        return tags.create(request.name(), request.useInAi(), request.values());
    }

    @PutMapping("/order")
    List<Tag> reorder(@Valid @RequestBody OrderRequest request) {
        return tags.reorder(request.ids());
    }

    @PutMapping("/{id}")
    Changed update(@PathVariable UUID id, @Valid @RequestBody UpdateTagRequest request) {
        return tags.update(id, request.name(), request.useInAi(),
                request.values().stream().map(value -> new ValueInput(value.id(), value.label())).toList(),
                request.version());
    }

    @DeleteMapping("/{id}")
    Cleared delete(@PathVariable UUID id) {
        return new Cleared(tags.delete(id));
    }
}

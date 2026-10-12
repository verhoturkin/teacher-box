package ru.teacherbox.ai.web;

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
import ru.teacherbox.ai.application.AiViews.PromptView;
import ru.teacherbox.ai.application.PromptLibrary;
import ru.teacherbox.ai.domain.HomeworkKind;
import ru.teacherbox.ai.domain.SavedPrompt;

/** The teacher's library of prompts. */
@RestController
@RequestMapping("/api/teacher/ai/prompts")
class TeacherPromptsController {

    /** @param kind blank — for any kind of homework */
    record PromptRequest(
            @NotBlank @Size(max = SavedPrompt.MAX_TITLE) String title,
            @NotBlank @Size(max = SavedPrompt.MAX_TEXT) String text,
            @Nullable HomeworkKind kind) {
    }

    record UpdatePromptRequest(
            @NotBlank @Size(max = SavedPrompt.MAX_TITLE) String title,
            @NotBlank @Size(max = SavedPrompt.MAX_TEXT) String text,
            @Nullable HomeworkKind kind,
            @NotNull Long version) {
    }

    private final PromptLibrary library;

    TeacherPromptsController(PromptLibrary library) {
        this.library = library;
    }

    @GetMapping
    List<PromptView> list() {
        return library.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    PromptView create(@Valid @RequestBody PromptRequest request) {
        return library.create(request.title(), request.text(), request.kind());
    }

    @PutMapping("/{promptId}")
    PromptView update(@PathVariable UUID promptId, @Valid @RequestBody UpdatePromptRequest request) {
        return library.update(promptId, request.title(), request.text(), request.kind(), request.version());
    }

    @DeleteMapping("/{promptId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable UUID promptId) {
        library.delete(promptId);
    }
}

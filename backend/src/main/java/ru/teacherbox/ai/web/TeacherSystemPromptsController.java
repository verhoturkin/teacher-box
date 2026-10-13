package ru.teacherbox.ai.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.ai.application.AiViews.SystemPromptView;
import ru.teacherbox.ai.application.SystemPrompts;
import ru.teacherbox.ai.domain.AiFeature;

/** System prompts of the assistant that the teacher rewrites (ADR-0043). */
@RestController
@RequestMapping("/api/teacher/ai/system-prompts")
class TeacherSystemPromptsController {

    /** @param version the version the teacher edited, {@code 0} for the default prompt */
    record SystemPromptRequest(
            @NotBlank @Size(max = SystemPrompts.MAX_TEXT) String text,
            @NotNull Long version) {
    }

    private final SystemPrompts prompts;

    TeacherSystemPromptsController(SystemPrompts prompts) {
        this.prompts = prompts;
    }

    @GetMapping
    List<SystemPromptView> list() {
        return prompts.list();
    }

    @PutMapping("/{feature}")
    SystemPromptView update(@PathVariable AiFeature feature, @Valid @RequestBody SystemPromptRequest request) {
        return prompts.update(feature, request.text(), request.version());
    }

    /** Back to the default prompt. */
    @DeleteMapping("/{feature}")
    SystemPromptView reset(@PathVariable AiFeature feature) {
        return prompts.reset(feature);
    }
}

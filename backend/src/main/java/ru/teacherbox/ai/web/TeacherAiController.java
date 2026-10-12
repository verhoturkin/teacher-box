package ru.teacherbox.ai.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.YearMonth;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.ai.application.AiAssistant;
import ru.teacherbox.ai.application.AiUsage;
import ru.teacherbox.ai.application.AiViews.AiStatus;
import ru.teacherbox.ai.application.AiViews.HomeworkBrief;
import ru.teacherbox.ai.application.AiViews.HomeworkDraft;
import ru.teacherbox.ai.application.AiViews.PageLook;
import ru.teacherbox.ai.application.AiViews.ReviewBrief;
import ru.teacherbox.ai.application.AiViews.ReviewDraft;
import ru.teacherbox.ai.application.AiViews.UsageReport;
import ru.teacherbox.ai.domain.HomeworkKind;
import ru.teacherbox.ai.domain.SavedPrompt;

/** The teacher's AI assistant. Texts are sent by the frontend: the module reads no other data. */
@RestController
@RequestMapping("/api/teacher/ai")
class TeacherAiController {

    /** The portal's colours ({@code #rrggbb}) and font for an interactive page. */
    record LookRequest(
            @NotBlank @Size(max = 100) @Pattern(regexp = FONT) String font,
            @NotBlank @Pattern(regexp = COLOR) String primary,
            @NotBlank @Pattern(regexp = COLOR) String surface,
            @NotBlank @Pattern(regexp = COLOR) String text) {
    }

    /**
     * @param title what the teacher already called the assignment
     * @param look  blank — the default look
     */
    record HomeworkDraftRequest(
            @NotNull HomeworkKind kind,
            @NotBlank @Size(max = SavedPrompt.MAX_TEXT) String prompt,
            @Size(max = 200) @Nullable String title,
            @Valid @Nullable LookRequest look) {
    }

    record ReviewDraftRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 20_000) @Nullable String description,
            @NotBlank @Size(max = 20_000) String answer) {
    }

    static final String COLOR = "#[0-9a-fA-F]{6}";
    /** Font names, commas, quotes and spaces: nothing that could end the CSS declaration. */
    static final String FONT = "[\\p{L}\\p{N} ,'\"-]+";

    private final AiAssistant assistant;
    private final AiUsage usage;

    TeacherAiController(AiAssistant assistant, AiUsage usage) {
        this.assistant = assistant;
        this.usage = usage;
    }

    @GetMapping("/status")
    AiStatus status() {
        return usage.status();
    }

    @PostMapping("/homework-draft")
    HomeworkDraft homeworkDraft(@Valid @RequestBody HomeworkDraftRequest request) {
        LookRequest look = request.look();
        return assistant.homeworkDraft(new HomeworkBrief(request.kind(), request.prompt(), request.title(),
                look == null ? PageLook.DEFAULT
                        : new PageLook(look.font(), look.primary(), look.surface(), look.text())));
    }

    @PostMapping("/review-draft")
    ReviewDraft reviewDraft(@Valid @RequestBody ReviewDraftRequest request) {
        return assistant.reviewDraft(new ReviewBrief(request.title(), request.description(), request.answer()));
    }

    /** @param month {@code yyyy-MM}, the current month by default */
    @GetMapping("/usage")
    UsageReport usage(@RequestParam(required = false) @Nullable YearMonth month) {
        return usage.report(month);
    }
}

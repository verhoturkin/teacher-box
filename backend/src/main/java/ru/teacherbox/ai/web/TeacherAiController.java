package ru.teacherbox.ai.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
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
import ru.teacherbox.ai.application.AiViews.ReviewBrief;
import ru.teacherbox.ai.application.AiViews.ReviewDraft;
import ru.teacherbox.ai.application.AiViews.UsageReport;

/** The teacher's AI assistant. Texts are sent by the frontend: the module reads no other data. */
@RestController
@RequestMapping("/api/teacher/ai")
class TeacherAiController {

    record HomeworkDraftRequest(
            @NotBlank @Size(max = 300) String topic,
            @Size(max = 100) @Nullable String level,
            @Min(1) @Max(20) int taskCount,
            @Size(max = 2_000) @Nullable String wishes) {
    }

    record ReviewDraftRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 20_000) @Nullable String description,
            @NotBlank @Size(max = 20_000) String answer) {
    }

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
        return assistant.homeworkDraft(
                new HomeworkBrief(request.topic(), request.level(), request.taskCount(), request.wishes()));
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

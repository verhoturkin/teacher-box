package ru.teacherbox.ai.web;

import java.time.YearMonth;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.ai.application.AiUsage;
import ru.teacherbox.ai.application.AiViews.AiStatus;
import ru.teacherbox.ai.application.AiViews.UsageReport;

/** Administrator: the AI provider and the log of requests (metadata only, no texts; ADR-0010). */
@RestController
@RequestMapping("/api/admin/ai")
class AdminAiController {

    private final AiUsage usage;

    AdminAiController(AiUsage usage) {
        this.usage = usage;
    }

    @GetMapping("/status")
    AiStatus status() {
        return usage.status();
    }

    /** @param month {@code yyyy-MM}, the current month by default */
    @GetMapping("/usage")
    UsageReport usage(@RequestParam(required = false) @Nullable YearMonth month) {
        return usage.report(month);
    }
}

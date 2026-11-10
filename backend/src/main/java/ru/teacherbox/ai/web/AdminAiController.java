package ru.teacherbox.ai.web;

import jakarta.validation.constraints.PositiveOrZero;
import java.time.YearMonth;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.ai.application.AiProviders;
import ru.teacherbox.ai.application.AiProviders.AdminProviderView;
import ru.teacherbox.ai.application.AiUsage;
import ru.teacherbox.ai.application.AiViews.AiStatus;
import ru.teacherbox.ai.application.AiViews.RequestPage;
import ru.teacherbox.ai.application.AiViews.UsageReport;

/** Administrator: the AI connections (no keys), the provider in use and the log of requests (metadata only, no texts; ADR-0010). */
@RestController
@RequestMapping("/api/admin/ai")
class AdminAiController {

    private final AiUsage usage;
    private final AiProviders providers;

    AdminAiController(AiUsage usage, AiProviders providers) {
        this.usage = usage;
        this.providers = providers;
    }

    /** The teacher's connections: kinds, whether a key is set, the last check and the number of models; no keys. */
    @GetMapping("/providers")
    List<AdminProviderView> providers() {
        return providers.adminList();
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

    /**
     * The request log of a month by pages of 10.
     *
     * @param month  {@code yyyy-MM}, the current month by default
     * @param offset how many newer requests are already shown
     */
    @GetMapping("/requests")
    RequestPage requests(@RequestParam(required = false) @Nullable YearMonth month,
            @RequestParam(defaultValue = "0") @PositiveOrZero int offset) {
        return usage.requests(month, offset);
    }
}

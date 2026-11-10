package ru.teacherbox.schedule.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.teacherbox.schedule.application.LessonRules;
import ru.teacherbox.schedule.application.LessonRulesService;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.security.CurrentUser;

/**
 * The teacher's lesson rules (ADR-0056), in force at once. The limits of a change are checked by
 * {@link LessonRulesService#change}; the time zone has its own {@code PUT /api/teacher/settings/time-zone}.
 */
@RestController
@RequestMapping("/api/teacher/schedule/settings")
class TeacherLessonRulesController {

    /**
     * @param defaultDurationMinutes  15–480
     * @param lateCancellationMinutes 0 – 7 days
     * @param reminderMinutes         at most 3, each 15 minutes – 7 days; empty: no reminders
     * @param horizonWeeks            4–26
     */
    record LessonRulesRequest(@NotNull Integer defaultDurationMinutes, @NotNull Integer lateCancellationMinutes,
            @NotNull List<@NotNull Integer> reminderMinutes, @NotNull Integer horizonWeeks) {
    }

    /** @param horizonWeeks whole weeks, rounded up (an imported horizon may be a number of days) */
    record LessonRulesView(int defaultDurationMinutes, long lateCancellationMinutes, List<Long> reminderMinutes,
            long horizonWeeks) {

        static LessonRulesView of(LessonRules rules) {
            return new LessonRulesView(rules.defaultDurationMinutes(), rules.lateCancellation().toMinutes(),
                    rules.reminders().stream().map(Duration::toMinutes).toList(),
                    (rules.horizonDays() + 6) / 7);
        }
    }

    private final LessonRulesService rules;

    TeacherLessonRulesController(LessonRulesService rules) {
        this.rules = rules;
    }

    @GetMapping
    LessonRulesView settings() {
        return LessonRulesView.of(rules.current());
    }

    @PutMapping
    LessonRulesView change(CurrentUser user, @Valid @RequestBody LessonRulesRequest request) {
        LessonRules changed = rules.change(new LessonRules(request.defaultDurationMinutes(),
                Duration.ofMinutes(request.lateCancellationMinutes()),
                request.reminderMinutes().stream().map(Duration::ofMinutes).toList(),
                Duration.ofDays(7L * request.horizonWeeks())));
        AuditLog.record(user.id(), "lesson-rules", "changed");
        return LessonRulesView.of(changed);
    }
}

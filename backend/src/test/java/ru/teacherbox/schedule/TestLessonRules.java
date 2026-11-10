package ru.teacherbox.schedule;

import java.time.Duration;
import java.util.List;
import ru.teacherbox.schedule.application.LessonRules;
import ru.teacherbox.schedule.application.LessonRulesService;

/**
 * The lesson rules every {@link ScheduleIntegrationTest} counts on: reminders 24 h and 1 h, late cancellation
 * 24 h, series four weeks ahead. Stored when the context starts; a test that changes them puts them back.
 */
public final class TestLessonRules {

    public static final LessonRules RULES = new LessonRules(60, Duration.ofHours(24),
            List.of(Duration.ofHours(24), Duration.ofHours(1)), Duration.ofDays(28));

    private final LessonRulesService rules;

    TestLessonRules(LessonRulesService rules) {
        this.rules = rules;
        restore();
    }

    public void restore() {
        rules.change(RULES);
    }
}

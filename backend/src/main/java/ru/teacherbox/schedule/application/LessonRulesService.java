package ru.teacherbox.schedule.application;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.schedule.persistence.ScheduleSettingsRepository;
import ru.teacherbox.schedule.persistence.ScheduleSettingsRepository.Setting;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * The teacher's lesson rules (ADR-0056), read from {@code schedule.settings} on every call, so a change is in
 * force at once: a shorter horizon removes no lessons, a longer one fills series up on the next run. Values
 * imported from the old variables keep the limits they had there; a change takes the limits of the settings
 * page.
 */
@Service
public class LessonRulesService {

    static final int MIN_DURATION = 15;
    static final int MAX_DURATION = 480;
    static final int MAX_REMINDERS = 3;
    static final Duration MIN_REMINDER = Duration.ofMinutes(15);
    static final Duration MAX_REMINDER = Duration.ofDays(7);
    static final Duration MAX_LATE_CANCELLATION = Duration.ofDays(7);
    static final int MIN_HORIZON_WEEKS = 4;
    static final int MAX_HORIZON_WEEKS = 26;

    private final ScheduleSettingsRepository settings;
    private final Clock clock;

    public LessonRulesService(ScheduleSettingsRepository settings, Clock clock) {
        this.settings = settings;
        this.clock = clock;
    }

    /** The rules in force; a value that is not set (or unreadable) is the default. */
    public LessonRules current() {
        Map<Setting, String> stored = settings.findAll();
        int duration = value(stored, Setting.DEFAULT_DURATION, Integer::valueOf)
                .orElse(LessonRules.DEFAULT_DURATION);
        Duration late = value(stored, Setting.LATE_CANCELLATION, Duration::parse)
                .orElse(LessonRules.DEFAULT_LATE_CANCELLATION);
        List<Duration> reminders = value(stored, Setting.REMINDERS, LessonRulesService::reminders)
                .orElse(LessonRules.DEFAULT_REMINDERS);
        Duration horizon = value(stored, Setting.HORIZON, Duration::parse).orElse(LessonRules.DEFAULT_HORIZON);
        LocalTime workStart = value(stored, Setting.WORK_START, LocalTime::parse)
                .orElse(LessonRules.DEFAULT_WORK_START);
        LocalTime workEnd = value(stored, Setting.WORK_END, LocalTime::parse).orElse(LessonRules.DEFAULT_WORK_END);
        // hours stored by hand that end before they start are unusable: the default instead
        if (!workStart.isBefore(workEnd)) {
            workStart = LessonRules.DEFAULT_WORK_START;
            workEnd = LessonRules.DEFAULT_WORK_END;
        }
        return new LessonRules(duration, late, reminders, horizon, workStart, workEnd);
    }

    /**
     * Stores all the rules at once.
     *
     * @throws BusinessRuleException if a value is outside the limits: duration 15–480 min, late cancellation
     *                               0–7 d, at most 3 reminders of 15 min – 7 d, horizon 4–26 weeks, the working
     *                               hours start before they end
     */
    @Transactional
    public LessonRules change(LessonRules rules) {
        if (rules.defaultDurationMinutes() < MIN_DURATION || rules.defaultDurationMinutes() > MAX_DURATION) {
            throw invalid("schedule.settings-duration-invalid",
                    "The lesson duration must be " + MIN_DURATION + "-" + MAX_DURATION + " minutes");
        }
        if (rules.lateCancellation().isNegative() || rules.lateCancellation().compareTo(MAX_LATE_CANCELLATION) > 0) {
            throw invalid("schedule.settings-late-cancellation-invalid",
                    "The late cancellation window must be 0-7 days");
        }
        if (rules.reminders().size() > MAX_REMINDERS || rules.reminders().stream()
                .anyMatch(reminder -> reminder.compareTo(MIN_REMINDER) < 0 || reminder.compareTo(MAX_REMINDER) > 0)) {
            throw invalid("schedule.settings-reminders-invalid",
                    "At most " + MAX_REMINDERS + " reminders of 15 minutes to 7 days");
        }
        if (rules.horizon().compareTo(Duration.ofDays(7L * MIN_HORIZON_WEEKS)) < 0
                || rules.horizon().compareTo(Duration.ofDays(7L * MAX_HORIZON_WEEKS)) > 0) {
            throw invalid("schedule.settings-horizon-invalid",
                    "The horizon must be " + MIN_HORIZON_WEEKS + "-" + MAX_HORIZON_WEEKS + " weeks");
        }
        if (!rules.workStart().isBefore(rules.workEnd())) {
            throw invalid("schedule.settings-working-hours-invalid", "The working hours must start before they end");
        }
        settings.save(rules.defaultDurationMinutes(), rules.lateCancellation().toString(),
                rules.reminders().stream().map(Duration::toString).collect(Collectors.joining(",")),
                rules.horizon().toString(), hhmm(rules.workStart()), hhmm(rules.workEnd()), clock.instant());
        return current();
    }

    private static <T> Optional<T> value(Map<Setting, String> stored, Setting setting, Function<String, T> parse) {
        String value = stored.get(setting);
        if (value == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(parse.apply(value));
        } catch (NumberFormatException | DateTimeParseException e) {
            return Optional.empty();
        }
    }

    /** {@code HH:mm}: seconds are not kept. */
    private static String hhmm(LocalTime time) {
        return time.withSecond(0).withNano(0).toString();
    }

    private static List<Duration> reminders(String value) {
        if (value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(",")).map(String::strip).map(Duration::parse).toList();
    }

    private static BusinessRuleException invalid(String code, String message) {
        return new BusinessRuleException(code, message);
    }
}

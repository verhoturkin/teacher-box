package ru.teacherbox.homework.application;

import java.time.Clock;
import java.time.Duration;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.homework.persistence.HomeworkSettingsRepository;
import ru.teacherbox.homework.persistence.HomeworkSettingsRepository.Setting;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * How long before the due date the student is reminded (ADR-0056): {@code homework.settings.due_soon_window},
 * read on every run of {@link DueSoonReminder}; not set: {@link #DEFAULT}. An imported value keeps the limits of
 * the old variable; a change takes 1–72 hours.
 */
@Service
public class DueSoonWindow {

    public static final Duration DEFAULT = Duration.ofHours(24);
    static final Duration MIN = Duration.ofHours(1);
    static final Duration MAX = Duration.ofHours(72);

    private final HomeworkSettingsRepository settings;
    private final Clock clock;

    public DueSoonWindow(HomeworkSettingsRepository settings, Clock clock) {
        this.settings = settings;
        this.clock = clock;
    }

    public Duration current() {
        return settings.find(Setting.DUE_SOON_WINDOW).flatMap(DueSoonWindow::parse).orElse(DEFAULT);
    }

    /** @throws BusinessRuleException if the window is outside 1–72 hours */
    @Transactional
    public Duration change(Duration window) {
        if (window.compareTo(MIN) < 0 || window.compareTo(MAX) > 0) {
            throw new BusinessRuleException("homework.settings-due-soon-invalid",
                    "The reminder must be 1-72 hours before the due date");
        }
        settings.save(Setting.DUE_SOON_WINDOW, window.toString(), clock.instant());
        return window;
    }

    private static Optional<Duration> parse(String value) {
        try {
            return Optional.of(Duration.parse(value)).filter(Duration::isPositive);
        } catch (DateTimeParseException e) {
            return Optional.empty();
        }
    }
}

package ru.teacherbox.homework.application;

import java.time.Clock;
import java.time.Duration;
import java.util.Set;
import org.springframework.stereotype.Component;
import ru.teacherbox.homework.persistence.HomeworkSettingsRepository;
import ru.teacherbox.homework.persistence.HomeworkSettingsRepository.Setting;
import ru.teacherbox.shared.settings.OldSettings;
import ru.teacherbox.shared.settings.TeacherSettingsImport;

/** The reminder before the due date from {@code .env} once (ADR-0056), unless the teacher set it. */
@Component
public class HomeworkSettingsImport implements TeacherSettingsImport {

    static final String DUE_SOON_WINDOW = "TEACHERBOX_HOMEWORK_DUE_SOON_WINDOW";

    private final HomeworkSettingsRepository settings;
    private final Clock clock;

    public HomeworkSettingsImport(HomeworkSettingsRepository settings, Clock clock) {
        this.settings = settings;
        this.clock = clock;
    }

    @Override
    public Set<String> names() {
        return Set.of(DUE_SOON_WINDOW);
    }

    @Override
    public Set<String> importFrom(OldSettings values) {
        return values.value(DUE_SOON_WINDOW, Duration.class)
                .filter(window -> window.isPositive())
                .filter(window -> settings.saveIfMissing(Setting.DUE_SOON_WINDOW, window.toString(), clock.instant()))
                .map(window -> Set.of(DUE_SOON_WINDOW))
                .orElse(Set.of());
    }
}

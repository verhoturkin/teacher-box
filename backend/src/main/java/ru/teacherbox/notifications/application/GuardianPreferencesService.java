package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.notifications.application.NotificationViews.GuardianPreferencesView;
import ru.teacherbox.notifications.domain.GuardianCategory;
import ru.teacherbox.notifications.domain.GuardianPreferences;
import ru.teacherbox.notifications.persistence.GuardianPreferencesRepository;

/** Which of the children's notices a guardian gets (ADR-0069): the four categories, all on by default. */
@Service
public class GuardianPreferencesService {

    private final GuardianPreferencesRepository preferences;
    private final Clock clock;

    public GuardianPreferencesService(GuardianPreferencesRepository preferences, Clock clock) {
        this.preferences = preferences;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public GuardianPreferencesView get(UUID guardianId) {
        return GuardianPreferencesView.of(find(guardianId));
    }

    @Transactional
    public GuardianPreferencesView save(UUID guardianId, List<GuardianCategory> disabled) {
        GuardianPreferences updated = new GuardianPreferences(Set.copyOf(disabled));
        preferences.save(guardianId, updated, clock.instant());
        return GuardianPreferencesView.of(updated);
    }

    GuardianPreferences find(UUID guardianId) {
        return preferences.find(guardianId).orElse(GuardianPreferences.DEFAULT);
    }
}

package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.time.LocalTime;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.notifications.application.NotificationViews.PreferencesView;
import ru.teacherbox.notifications.domain.NotificationTopic;
import ru.teacherbox.notifications.domain.Preferences;
import ru.teacherbox.notifications.persistence.PreferencesRepository;

/** What a user gets in messengers: muted topics and quiet hours. */
@Service
public class PreferencesService {

    private final PreferencesRepository preferences;
    private final Clock clock;

    public PreferencesService(PreferencesRepository preferences, Clock clock) {
        this.preferences = preferences;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PreferencesView get(UUID recipientId) {
        return PreferencesView.of(preferences.find(recipientId).orElse(Preferences.DEFAULT));
    }

    /** @param quietFrom and {@code quietTo} both set or both {@code null} (no quiet hours) */
    @Transactional
    public PreferencesView save(UUID recipientId, List<NotificationTopic> mutedTopics, @Nullable LocalTime quietFrom,
            @Nullable LocalTime quietTo) {
        EnumSet<NotificationTopic> muted = EnumSet.noneOf(NotificationTopic.class);
        muted.addAll(mutedTopics);
        Preferences updated = new Preferences(muted, minutes(quietFrom), minutes(quietTo));
        preferences.save(recipientId, updated, clock.instant());
        return PreferencesView.of(updated);
    }

    private static @Nullable LocalTime minutes(@Nullable LocalTime time) {
        return time == null ? null : time.withSecond(0).withNano(0);
    }
}

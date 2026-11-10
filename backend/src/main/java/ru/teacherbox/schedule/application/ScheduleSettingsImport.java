package ru.teacherbox.schedule.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import ru.teacherbox.schedule.persistence.GoogleRepository;
import ru.teacherbox.schedule.persistence.ScheduleSettingsRepository;
import ru.teacherbox.schedule.persistence.ScheduleSettingsRepository.Setting;
import ru.teacherbox.schedule.domain.GoogleConnection;
import ru.teacherbox.shared.settings.OldSettings;
import ru.teacherbox.shared.settings.TeacherSettingsImport;

/**
 * The lesson rules and the Google Calendar OAuth client from {@code .env} once (ADR-0056), each unless the
 * teacher set it, with the limits the variables had. The lesson length of billing and of the schedule become
 * one: the schedule's variable wins, billing's is taken when only it is set.
 */
@Component
public class ScheduleSettingsImport implements TeacherSettingsImport {

    static final String DEFAULT_DURATION = "TEACHERBOX_SCHEDULE_DEFAULT_DURATION";
    static final String BILLING_DURATION = "TEACHERBOX_BILLING_DEFAULT_LESSON_DURATION";
    static final String LATE_CANCELLATION = "TEACHERBOX_SCHEDULE_LATE_CANCELLATION";
    static final String REMINDERS = "TEACHERBOX_SCHEDULE_REMINDERS";
    static final String HORIZON = "TEACHERBOX_SCHEDULE_HORIZON";
    static final String CLIENT_ID = "TEACHERBOX_SCHEDULE_GOOGLE_CLIENT_ID";
    static final String CLIENT_SECRET = "TEACHERBOX_SCHEDULE_GOOGLE_CLIENT_SECRET";

    private final ScheduleSettingsRepository settings;
    private final GoogleRepository google;
    private final Clock clock;

    public ScheduleSettingsImport(ScheduleSettingsRepository settings, GoogleRepository google, Clock clock) {
        this.settings = settings;
        this.google = google;
        this.clock = clock;
    }

    @Override
    public Set<String> names() {
        return Set.of(DEFAULT_DURATION, BILLING_DURATION, LATE_CANCELLATION, REMINDERS, HORIZON, CLIENT_ID,
                CLIENT_SECRET);
    }

    @Override
    public Set<String> importFrom(OldSettings values) {
        Instant now = clock.instant();
        Set<String> stored = new TreeSet<>();
        for (String name : List.of(DEFAULT_DURATION, BILLING_DURATION)) {
            Optional<Integer> minutes = values.value(name, Integer.class).filter(value -> value >= 1 && value <= 600);
            if (minutes.isPresent()) {
                if (settings.saveIfMissing(Setting.DEFAULT_DURATION, minutes.get(), now)) {
                    stored.add(name);
                }
                break;
            }
        }
        values.value(LATE_CANCELLATION, Duration.class)
                .filter(window -> !window.isNegative())
                .filter(window -> settings.saveIfMissing(Setting.LATE_CANCELLATION, window.toString(), now))
                .ifPresent(window -> stored.add(LATE_CANCELLATION));
        reminders(values)
                .filter(reminders -> settings.saveIfMissing(Setting.REMINDERS, reminders, now))
                .ifPresent(reminders -> stored.add(REMINDERS));
        values.value(HORIZON, Duration.class)
                .filter(horizon -> horizon.compareTo(Duration.ofDays(7)) >= 0)
                .filter(horizon -> settings.saveIfMissing(Setting.HORIZON, horizon.toString(), now))
                .ifPresent(horizon -> stored.add(HORIZON));
        if (client(values, now)) {
            stored.add(CLIENT_ID);
            stored.add(CLIENT_SECRET);
        }
        return stored;
    }

    /** Positive, sorted, without repeats; an empty variable means no reminders. */
    private static Optional<String> reminders(OldSettings values) {
        if (values.blank(REMINDERS)) {
            return Optional.of("");
        }
        return values.list(REMINDERS, Duration.class)
                .filter(reminders -> reminders.stream().allMatch(Duration::isPositive))
                .map(reminders -> reminders.stream().distinct().sorted().map(Duration::toString)
                        .collect(Collectors.joining(",")));
    }

    /** Both variables, as they were read, and only while no client is entered in the settings. */
    private boolean client(OldSettings values, Instant now) {
        Optional<String> id = values.text(CLIENT_ID);
        Optional<String> secret = values.text(CLIENT_SECRET);
        GoogleConnection connection = google.connection().orElseGet(() -> GoogleConnection.none(now));
        if (id.isEmpty() || secret.isEmpty() || connection.clientId() != null) {
            return false;
        }
        google.save(connection.withClient(id.get(), secret.get(), now));
        return true;
    }
}

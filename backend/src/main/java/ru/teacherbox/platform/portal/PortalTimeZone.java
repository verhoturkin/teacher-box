package ru.teacherbox.platform.portal;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.Optional;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.settings.SettingsChanged;
import ru.teacherbox.shared.time.InstanceTimeZone;

/**
 * The teacher's time zone in {@code platform.portal_settings.time_zone} (ADR-0056), read on every call of
 * {@link InstanceTimeZone#zoneId()}. Empty (a new portal, a full reset): {@link #DEFAULT}; the variable
 * {@code TEACHERBOX_TIMEZONE} is only imported once ({@link PortalSettingsImport}).
 */
public class PortalTimeZone {

    public static final ZoneId DEFAULT = ZoneId.of("Europe/Moscow");

    private final JdbcClient jdbc;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public PortalTimeZone(JdbcClient jdbc, ApplicationEventPublisher events, Clock clock) {
        this.jdbc = jdbc;
        this.events = events;
        this.clock = clock;
    }

    /** The zone in force: the stored one, else {@link #DEFAULT}. */
    public ZoneId current() {
        return jdbc.sql("select time_zone from platform.portal_settings where id = 1")
                .query(String.class)
                .optional()
                .flatMap(PortalTimeZone::parse)
                .orElse(DEFAULT);
    }

    /**
     * Stores the zone and puts it in force at once: the jobs are scheduled anew ({@link SettingsChanged});
     * stored instants stay as they are.
     *
     * @param id a region of the time zone database, e.g. {@code Asia/Yekaterinburg}
     * @throws BusinessRuleException if the zone is unknown
     */
    public ZoneId change(String id) {
        ZoneId zone = parse(id).orElseThrow(() -> new BusinessRuleException("portal.time-zone-invalid",
                "Unknown time zone"));
        jdbc.sql("""
                update platform.portal_settings set time_zone = :zone, updated_at = :now, version = version + 1
                where id = 1
                """)
                .param("zone", zone.getId())
                .param("now", clock.instant())
                .update();
        events.publishEvent(new SettingsChanged(Set.of(InstanceTimeZone.SETTING)));
        return zone;
    }

    /** Regions only ({@code Europe/Moscow}, {@code UTC}): no bare offsets that ignore summer time. */
    static Optional<ZoneId> parse(String id) {
        String trimmed = id.strip();
        if (!ZoneId.getAvailableZoneIds().contains(trimmed)) {
            return Optional.empty();
        }
        try {
            return Optional.of(ZoneId.of(trimmed));
        } catch (DateTimeException e) {
            return Optional.empty();
        }
    }
}

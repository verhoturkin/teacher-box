package ru.teacherbox.platform.portal;

import java.time.Clock;
import java.time.ZoneId;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.teacherbox.shared.portal.PortalAddress;
import ru.teacherbox.shared.settings.OldSettings;
import ru.teacherbox.shared.settings.TeacherSettingsImport;

/** The portal address and the time zone from {@code .env} once (ADR-0056), unless the teacher set them. */
public class PortalSettingsImport implements TeacherSettingsImport {

    static final String ADDRESS = "TEACHERBOX_PUBLIC_URL";
    static final String TIME_ZONE = "TEACHERBOX_TIMEZONE";

    private final JdbcClient jdbc;
    private final Clock clock;

    public PortalSettingsImport(JdbcClient jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Override
    public Set<String> names() {
        return Set.of(ADDRESS, TIME_ZONE);
    }

    @Override
    public Set<String> importFrom(OldSettings values) {
        Set<String> stored = new TreeSet<>();
        values.text(ADDRESS).flatMap(PortalAddress::parse)
                .filter(address -> store("address", address))
                .ifPresent(address -> stored.add(ADDRESS));
        values.text(TIME_ZONE).flatMap(PortalTimeZone::parse).map(ZoneId::getId)
                .filter(zone -> store("time_zone", zone))
                .ifPresent(zone -> stored.add(TIME_ZONE));
        return stored;
    }

    private boolean store(String column, String value) {
        return jdbc.sql("update platform.portal_settings set " + column + " = :value, updated_at = :now,"
                + " version = version + 1 where id = 1 and " + column + " is null")
                .param("value", value)
                .param("now", clock.instant())
                .update() == 1;
    }

}

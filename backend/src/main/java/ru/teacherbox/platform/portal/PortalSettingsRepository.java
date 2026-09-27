package ru.teacherbox.platform.portal;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;

/** The single row of {@code platform.portal_settings}. */
public class PortalSettingsRepository {

    private final JdbcClient jdbc;

    public PortalSettingsRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public PortalSettings load() {
        return jdbc.sql("""
                select name, address, setup_completed_at, updated_at, version
                from platform.portal_settings where id = 1
                """)
                .query(PortalSettingsRepository::map)
                .single();
    }

    /**
     * @return the saved settings with their new version
     * @throws OptimisticLockingFailureException if they were changed since they were loaded
     */
    public PortalSettings save(PortalSettings settings) {
        int updated = jdbc.sql("""
                update platform.portal_settings
                set name = :name, address = :address, setup_completed_at = :setupCompletedAt,
                    updated_at = :updatedAt, version = version + 1
                where id = 1 and version = :version
                """)
                .param("name", settings.name())
                .param("address", settings.address())
                .param("setupCompletedAt", settings.setupCompletedAt())
                .param("updatedAt", settings.updatedAt())
                .param("version", settings.version())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Portal settings were modified");
        }
        return new PortalSettings(settings.name(), settings.address(), settings.setupCompletedAt(),
                settings.updatedAt(), settings.version() + 1);
    }

    private static PortalSettings map(ResultSet rs, int row) throws SQLException {
        return new PortalSettings(rs.getString("name"), rs.getString("address"),
                rs.getObject("setup_completed_at", Instant.class), rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}

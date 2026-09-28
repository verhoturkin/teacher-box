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
                select name, address, accent, logo_key, logo_type, setup_completed_at, updated_at, version
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
        PortalSettings.Logo logo = settings.logo();
        int updated = jdbc.sql("""
                update platform.portal_settings
                set name = :name, address = :address, accent = :accent, logo_key = :logoKey,
                    logo_type = :logoType, setup_completed_at = :setupCompletedAt, updated_at = :updatedAt,
                    version = version + 1
                where id = 1 and version = :version
                """)
                .param("name", settings.name())
                .param("address", settings.address())
                .param("accent", settings.accent() == null ? null : settings.accent().value())
                .param("logoKey", logo == null ? null : logo.key())
                .param("logoType", logo == null ? null : logo.contentType())
                .param("setupCompletedAt", settings.setupCompletedAt())
                .param("updatedAt", settings.updatedAt())
                .param("version", settings.version())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Portal settings were modified");
        }
        return new PortalSettings(settings.name(), settings.address(), settings.accent(), logo,
                settings.setupCompletedAt(), settings.updatedAt(), settings.version() + 1);
    }

    private static PortalSettings map(ResultSet rs, int row) throws SQLException {
        String accent = rs.getString("accent");
        String logoKey = rs.getString("logo_key");
        String logoType = rs.getString("logo_type");
        return new PortalSettings(rs.getString("name"), rs.getString("address"),
                accent == null ? null : PortalAccent.parse(accent).orElse(null),
                logoKey == null || logoType == null ? null : new PortalSettings.Logo(logoKey, logoType),
                rs.getObject("setup_completed_at", Instant.class), rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}

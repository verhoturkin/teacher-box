package ru.teacherbox.platform.portal;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.teacherbox.shared.reset.DataReset;

/**
 * Full reset (ADR-0014): the name and the address of the portal go back to the defaults and the first
 * setup opens again.
 */
public class PortalDataReset implements DataReset {

    private final JdbcClient jdbc;

    public PortalDataReset(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<String> tables() {
        return List.of("platform.portal_settings");
    }

    @Override
    public void erase() {
        jdbc.sql("""
                update platform.portal_settings
                set name = null, address = null, accent = null, logo_key = null, logo_type = null,
                    setup_completed_at = null, updated_at = null, version = version + 1
                where id = 1
                """).update();
    }
}

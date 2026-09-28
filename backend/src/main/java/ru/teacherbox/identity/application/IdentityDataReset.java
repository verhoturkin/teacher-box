package ru.teacherbox.identity.application;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.reset.DataReset;

/**
 * Full reset (ADR-0014): students, their invitations and sessions, groups. The accounts of the
 * teacher and the administrator stay with their passwords and sessions.
 */
@Component
class IdentityDataReset implements DataReset {

    private static final List<String> TABLES = List.of("identity.group_members", "identity.student_groups",
            "identity.invites", "identity.refresh_tokens", "identity.users");

    private final JdbcClient jdbc;

    IdentityDataReset(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<String> tables() {
        return TABLES;
    }

    @Override
    public void erase() {
        jdbc.sql("delete from identity.group_members").update();
        jdbc.sql("delete from identity.student_groups").update();
        jdbc.sql("delete from identity.invites").update();
        jdbc.sql("""
                delete from identity.refresh_tokens
                where user_id in (select id from identity.users where role = 'STUDENT')
                """).update();
        jdbc.sql("delete from identity.users where role = 'STUDENT'").update();
    }
}

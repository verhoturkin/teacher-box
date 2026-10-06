package ru.teacherbox.meetings.application;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.reset.DataReset;

/** Full reset (ADR-0014): the external call links. */
@Component
class MeetingsDataReset implements DataReset {

    private static final List<String> TABLES = List.of("meetings.rooms");

    private final JdbcClient jdbc;

    MeetingsDataReset(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<String> tables() {
        return TABLES;
    }

    @Override
    public void erase() {
        for (String table : TABLES) {
            jdbc.sql("delete from " + table).update();
        }
    }
}

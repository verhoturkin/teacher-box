package ru.teacherbox.ai.application;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.reset.DataReset;

/** Full reset (ADR-0014): the log of requests to the AI. */
@Component
class AiDataReset implements DataReset {

    private static final List<String> TABLES = List.of("ai.requests");

    private final JdbcClient jdbc;

    AiDataReset(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<String> tables() {
        return TABLES;
    }

    @Override
    public void erase() {
        jdbc.sql("delete from ai.requests").update();
    }
}

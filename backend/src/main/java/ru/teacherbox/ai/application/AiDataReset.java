package ru.teacherbox.ai.application;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.reset.DataReset;

/**
 * Full reset (ADR-0014): the log of requests to the AI, the library of prompts, the teacher's system prompts, the
 * providers with their models and the AI settings (ADR-0057). The old variables are not imported again (ADR-0056).
 */
@Component
class AiDataReset implements DataReset {

    private static final List<String> TABLES = List.of("ai.requests", "ai.prompts", "ai.system_prompts", "ai.settings",
            "ai.models", "ai.providers");

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
        jdbc.sql("delete from ai.prompts").update();
        jdbc.sql("delete from ai.system_prompts").update();
        jdbc.sql("delete from ai.settings").update();
        jdbc.sql("delete from ai.models").update();
        jdbc.sql("delete from ai.providers").update();
    }
}

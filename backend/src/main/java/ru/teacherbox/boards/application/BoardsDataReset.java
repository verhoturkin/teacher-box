package ru.teacherbox.boards.application;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.data.DataReset;

/** Full reset (ADR-0014): the boards of students and groups. */
@Component
class BoardsDataReset implements DataReset {

    private static final List<String> TABLES = List.of("boards.boards");

    private final JdbcClient jdbc;

    BoardsDataReset(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<String> tables() {
        return TABLES;
    }

    @Override
    public void erase() {
        jdbc.sql("delete from boards.boards").update();
    }
}

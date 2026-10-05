package ru.teacherbox.boards.application;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.reset.DataReset;

/**
 * Full reset (ADR-0014): boards with their members, scenes, copies, images (the files are deleted by the
 * platform) and the users' libraries.
 */
@Component
class BoardsDataReset implements DataReset {

    private static final List<String> TABLES = List.of("boards.board_files", "boards.board_backups",
            "boards.board_libraries", "boards.board_scenes", "boards.board_members", "boards.boards");

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
        TABLES.forEach(table -> jdbc.sql("delete from " + table).update());
    }
}

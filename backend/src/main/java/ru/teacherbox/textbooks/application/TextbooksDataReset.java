package ru.teacherbox.textbooks.application;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.reset.DataReset;

/**
 * Full reset (ADR-0014): textbooks with their members, courses with their students and groups (ADR-0071); the files
 * are deleted by the platform.
 */
@Component
class TextbooksDataReset implements DataReset {

    private static final List<String> TABLES = List.of("textbooks.textbook_members", "textbooks.textbooks",
            "textbooks.student_courses", "textbooks.group_courses", "textbooks.courses");

    private final JdbcClient jdbc;

    TextbooksDataReset(JdbcClient jdbc) {
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

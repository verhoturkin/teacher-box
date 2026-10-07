package ru.teacherbox.homework.application;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.reset.DataReset;

/**
 * Full reset (ADR-0014): assignments, tasks, submissions and attachments (the files are deleted by
 * the platform).
 */
@Component
class HomeworkDataReset implements DataReset {

    private static final List<String> TABLES = List.of("homework.attachments", "homework.submissions",
            "homework.tasks", "homework.assignment_textbooks", "homework.assignments");

    private final JdbcClient jdbc;

    HomeworkDataReset(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<String> tables() {
        return TABLES;
    }

    @Override
    public void erase() {
        jdbc.sql("delete from homework.attachments").update();
        jdbc.sql("delete from homework.submissions").update();
        jdbc.sql("delete from homework.tasks").update();
        jdbc.sql("delete from homework.assignment_textbooks").update();
        jdbc.sql("delete from homework.assignments").update();
    }
}

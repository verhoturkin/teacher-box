package ru.teacherbox.homework.application;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.reset.DataReset;

/**
 * Full reset (ADR-0014): assignments with their videos and quizzes (questions, attempts, answers), tasks,
 * submissions and attachments (the files are deleted by the platform).
 */
@Component
class HomeworkDataReset implements DataReset {

    private static final List<String> TABLES = List.of("homework.quiz_answers", "homework.quiz_attempts",
            "homework.assignment_questions", "homework.attachments", "homework.submissions",
            "homework.tasks", "homework.assignment_textbooks", "homework.assignment_videos",
            "homework.assignment_draft_students",
            "homework.assignments");

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
        jdbc.sql("delete from homework.quiz_answers").update();
        jdbc.sql("delete from homework.quiz_attempts").update();
        jdbc.sql("delete from homework.assignment_questions").update();
        jdbc.sql("delete from homework.attachments").update();
        jdbc.sql("delete from homework.submissions").update();
        jdbc.sql("delete from homework.assignment_draft_students").update();
        jdbc.sql("delete from homework.tasks").update();
        jdbc.sql("delete from homework.assignment_textbooks").update();
        jdbc.sql("delete from homework.assignment_videos").update();
        jdbc.sql("delete from homework.assignments").update();
    }
}

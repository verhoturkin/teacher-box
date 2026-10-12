package ru.teacherbox.homework.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.homework.domain.InteractiveResult;
import ru.teacherbox.homework.domain.Submission;
import tools.jackson.databind.json.JsonMapper;

@Repository
public class SubmissionRepository {

    private final JdbcClient jdbc;
    private final JsonMapper json;

    public SubmissionRepository(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public void insert(Submission submission) {
        jdbc.sql("""
                insert into homework.submissions (id, task_id, text, result, submitted_at)
                values (:id, :taskId, :text, :result, :submittedAt)
                """)
                .param("id", submission.id())
                .param("taskId", submission.taskId())
                .param("text", submission.text())
                .param("result", submission.result() == null ? null : json.writeValueAsString(submission.result()))
                .param("submittedAt", submission.submittedAt())
                .update();
    }

    /** Newest first. */
    public List<Submission> findByTask(UUID taskId) {
        return jdbc.sql("""
                select id, task_id, text, result, submitted_at from homework.submissions
                where task_id = :taskId order by submitted_at desc
                """)
                .param("taskId", taskId)
                .query(this::map)
                .list();
    }

    private Submission map(ResultSet rs, int rowNum) throws SQLException {
        String result = rs.getString("result");
        return new Submission(
                rs.getObject("id", UUID.class),
                rs.getObject("task_id", UUID.class),
                rs.getString("text"),
                result == null ? null : json.readValue(result, InteractiveResult.class),
                rs.getObject("submitted_at", Instant.class));
    }
}

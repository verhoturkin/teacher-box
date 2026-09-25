package ru.teacherbox.homework.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.homework.domain.Submission;

@Repository
public class SubmissionRepository {

    private final JdbcClient jdbc;

    public SubmissionRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Submission submission) {
        jdbc.sql("""
                insert into homework.submissions (id, task_id, text, submitted_at)
                values (:id, :taskId, :text, :submittedAt)
                """)
                .param("id", submission.id())
                .param("taskId", submission.taskId())
                .param("text", submission.text())
                .param("submittedAt", submission.submittedAt())
                .update();
    }

    /** Newest first. */
    public List<Submission> findByTask(UUID taskId) {
        return jdbc.sql("""
                select id, task_id, text, submitted_at from homework.submissions
                where task_id = :taskId order by submitted_at desc
                """)
                .param("taskId", taskId)
                .query(SubmissionRepository::map)
                .list();
    }

    private static Submission map(ResultSet rs, int rowNum) throws SQLException {
        return new Submission(
                rs.getObject("id", UUID.class),
                rs.getObject("task_id", UUID.class),
                rs.getString("text"),
                rs.getObject("submitted_at", Instant.class));
    }
}

package ru.teacherbox.homework.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.homework.domain.HomeworkTask;
import ru.teacherbox.homework.domain.TaskStatus;

@Repository
public class TaskRepository {

    private static final String COLUMNS = """
            t.id, t.assignment_id, t.student_id, t.status, t.grade, t.teacher_comment, t.assigned_at,
            t.submitted_at, t.reviewed_at, t.due_reminder_sent_at, t.version
            """;
    private static final String SELECT = "select " + COLUMNS + " from homework.tasks t";

    private final JdbcClient jdbc;

    public TaskRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(HomeworkTask task) {
        jdbc.sql("""
                insert into homework.tasks (id, assignment_id, student_id, status, grade, teacher_comment,
                    assigned_at, submitted_at, reviewed_at, due_reminder_sent_at, version)
                values (:id, :assignmentId, :studentId, :status, :grade, :comment, :assignedAt, :submittedAt,
                    :reviewedAt, :reminderAt, :version)
                """)
                .param("id", task.id())
                .param("assignmentId", task.assignmentId())
                .param("studentId", task.studentId())
                .param("status", task.status().name())
                .param("grade", task.grade())
                .param("comment", task.teacherComment())
                .param("assignedAt", task.assignedAt())
                .param("submittedAt", task.submittedAt())
                .param("reviewedAt", task.reviewedAt())
                .param("reminderAt", task.dueReminderSentAt())
                .param("version", task.version())
                .update();
    }

    public void update(HomeworkTask task) {
        int updated = jdbc.sql("""
                update homework.tasks
                set status = :status, grade = :grade, teacher_comment = :comment, submitted_at = :submittedAt,
                    reviewed_at = :reviewedAt, due_reminder_sent_at = :reminderAt, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", task.id())
                .param("version", task.version())
                .param("status", task.status().name())
                .param("grade", task.grade())
                .param("comment", task.teacherComment())
                .param("submittedAt", task.submittedAt())
                .param("reviewedAt", task.reviewedAt())
                .param("reminderAt", task.dueReminderSentAt())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Task " + task.id() + " was modified");
        }
        task.markSaved(task.version() + 1);
    }

    public Optional<HomeworkTask> findById(UUID id) {
        return jdbc.sql(SELECT + " where t.id = :id").param("id", id).query(TaskRepository::map).optional();
    }

    public List<HomeworkTask> findByAssignment(UUID assignmentId) {
        return jdbc.sql(SELECT + " where t.assignment_id = :assignmentId order by t.assigned_at, t.id")
                .param("assignmentId", assignmentId)
                .query(TaskRepository::map)
                .list();
    }

    public List<HomeworkTask> findByStudent(UUID studentId) {
        return jdbc.sql(SELECT + " where t.student_id = :studentId order by t.assigned_at desc")
                .param("studentId", studentId)
                .query(TaskRepository::map)
                .list();
    }

    /** Tasks waiting for review, oldest submission first. */
    public List<HomeworkTask> findSubmitted() {
        return jdbc.sql(SELECT + " where t.status = 'SUBMITTED' order by t.submitted_at")
                .query(TaskRepository::map)
                .list();
    }

    /** Open tasks due in {@code (from, until]} without a reminder yet. */
    public List<HomeworkTask> findDueWithoutReminder(Instant from, Instant until) {
        return jdbc.sql(SELECT + """
                 join homework.assignments a on a.id = t.assignment_id
                 where t.status in ('ASSIGNED', 'RETURNED') and t.due_reminder_sent_at is null
                   and a.due_at > :from and a.due_at <= :until
                """)
                .param("from", from)
                .param("until", until)
                .query(TaskRepository::map)
                .list();
    }

    /** A due date of an open task. */
    public record OpenDeadline(UUID studentId, Instant dueAt) {
    }

    /** Due dates of all open tasks that have one. */
    public List<OpenDeadline> findOpenDeadlines() {
        return jdbc.sql("""
                select t.student_id, a.due_at from homework.tasks t
                join homework.assignments a on a.id = t.assignment_id
                where t.status in ('ASSIGNED', 'RETURNED') and a.due_at is not null
                """)
                .query((rs, rowNum) -> new OpenDeadline(rs.getObject("student_id", UUID.class),
                        rs.getObject("due_at", Instant.class)))
                .list();
    }

    /** Number of tasks per status for every assignment. */
    public Map<UUID, Map<TaskStatus, Integer>> statusCounts() {
        Map<UUID, Map<TaskStatus, Integer>> counts = new HashMap<>();
        jdbc.sql("select assignment_id, status, count(*) as tasks from homework.tasks group by assignment_id, status")
                .query((ResultSet rs) -> {
                    counts.computeIfAbsent(rs.getObject("assignment_id", UUID.class),
                                    id -> new EnumMap<>(TaskStatus.class))
                            .put(TaskStatus.valueOf(rs.getString("status")), rs.getInt("tasks"));
                });
        return counts;
    }

    private static HomeworkTask map(ResultSet rs, int rowNum) throws SQLException {
        return HomeworkTask.restore(
                rs.getObject("id", UUID.class),
                rs.getObject("assignment_id", UUID.class),
                rs.getObject("student_id", UUID.class),
                TaskStatus.valueOf(rs.getString("status")),
                rs.getString("grade"),
                rs.getString("teacher_comment"),
                rs.getObject("assigned_at", Instant.class),
                rs.getObject("submitted_at", Instant.class),
                rs.getObject("reviewed_at", Instant.class),
                rs.getObject("due_reminder_sent_at", Instant.class),
                rs.getLong("version"));
    }
}

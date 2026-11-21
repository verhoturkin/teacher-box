package ru.teacherbox.homework.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.homework.domain.Assignment;
import ru.teacherbox.homework.domain.quiz.RevealRule;
import ru.teacherbox.shared.persistence.OptimisticLock;

@Repository
public class AssignmentRepository {

    private static final String SELECT =
            """
            select id, title, description, due_at, board_id, course_id, quiz_reveal, quiz_attempts, bank, source_id,
                created_at, updated_at, version
            from homework.assignments""";

    private final JdbcClient jdbc;

    public AssignmentRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Assignment assignment) {
        jdbc.sql("""
                insert into homework.assignments (id, title, description, due_at, course_id, quiz_reveal, quiz_attempts,
                    bank, source_id, created_at, updated_at, version)
                values (:id, :title, :description, :dueAt, :courseId, :quizReveal, :quizAttempts, :bank, :sourceId,
                    :createdAt, :updatedAt, :version)
                """)
                .param("id", assignment.id())
                .param("title", assignment.title())
                .param("description", assignment.description())
                .param("dueAt", assignment.dueAt())
                .param("courseId", assignment.courseId())
                .param("quizReveal", assignment.quizReveal().name())
                .param("quizAttempts", assignment.quizAttempts())
                .param("bank", assignment.bank())
                .param("sourceId", assignment.sourceId())
                .param("createdAt", assignment.createdAt())
                .param("updatedAt", assignment.updatedAt())
                .param("version", assignment.version())
                .update();
    }

    public void update(Assignment assignment) {
        int updated = jdbc.sql("""
                update homework.assignments
                set title = :title, description = :description, due_at = :dueAt, course_id = :courseId,
                    quiz_reveal = :quizReveal,
                    quiz_attempts = :quizAttempts, updated_at = :updatedAt, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", assignment.id())
                .param("version", assignment.version())
                .param("title", assignment.title())
                .param("description", assignment.description())
                .param("dueAt", assignment.dueAt())
                .param("courseId", assignment.courseId())
                .param("quizReveal", assignment.quizReveal().name())
                .param("quizAttempts", assignment.quizAttempts())
                .param("updatedAt", assignment.updatedAt())
                .update();
        OptimisticLock.requireUpdated(updated, "Assignment", assignment.id());
        assignment.markSaved(assignment.version() + 1);
    }

    public void delete(UUID id) {
        jdbc.sql("delete from homework.assignments where id = :id").param("id", id).update();
    }

    /** The bank original is not part of the teacher's edits: it changes without a new version. */
    public void updateSource(Assignment assignment) {
        jdbc.sql("update homework.assignments set source_id = :sourceId where id = :id")
                .param("id", assignment.id())
                .param("sourceId", assignment.sourceId())
                .update();
    }

    /** The board is not part of the teacher's edits: it changes without a new version. */
    public void updateBoard(Assignment assignment) {
        jdbc.sql("update homework.assignments set board_id = :boardId where id = :id")
                .param("id", assignment.id())
                .param("boardId", assignment.boardId())
                .update();
    }

    public Optional<Assignment> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(AssignmentRepository::map).optional();
    }

    public List<Assignment> findByIds(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT + " where id in (:ids)").param("ids", ids).query(AssignmentRepository::map).list();
    }

    /** Assignments due in {@code [from, to)}, the earliest first. */
    public List<Assignment> findDueBetween(Instant from, Instant to) {
        return jdbc.sql(SELECT + " where due_at >= :from and due_at < :to order by due_at, title, id")
                .param("from", from)
                .param("to", to)
                .query(AssignmentRepository::map)
                .list();
    }

    /** The course was deleted (ADR-0071): its assignments are left without one; the versions stay. */
    public void clearCourse(UUID courseId) {
        jdbc.sql("update homework.assignments set course_id = null where course_id = :id").param("id", courseId)
                .update();
    }

    /** Working assignments ({@code bank = false}) or the bank items, newest first. */
    public List<Assignment> findAll(boolean bank) {
        return jdbc.sql(SELECT + " where bank = :bank order by created_at desc").param("bank", bank)
                .query(AssignmentRepository::map).list();
    }

    /** Bank item id → how many working assignments came from it or were saved as it. */
    public Map<UUID, Integer> uses() {
        Map<UUID, Integer> counts = new HashMap<>();
        jdbc.sql("select source_id, count(*) as total from homework.assignments where source_id is not null"
                + " group by source_id")
                .query((ResultSet rs) -> {
                    counts.put(rs.getObject("source_id", UUID.class), rs.getInt("total"));
                });
        return counts;
    }

    /** How many working assignments came from the bank item or were saved as it. */
    public int countUses(UUID bankItemId) {
        return jdbc.sql("select count(*) from homework.assignments where source_id = :id").param("id", bankItemId)
                .query(Integer.class).single();
    }

    private static Assignment map(ResultSet rs, int rowNum) throws SQLException {
        return Assignment.restore(
                rs.getObject("id", UUID.class),
                rs.getString("title"),
                rs.getString("description"),
                rs.getObject("due_at", Instant.class),
                rs.getObject("board_id", UUID.class),
                rs.getObject("course_id", UUID.class),
                RevealRule.valueOf(rs.getString("quiz_reveal")),
                rs.getObject("quiz_attempts", Integer.class),
                rs.getBoolean("bank"),
                rs.getObject("source_id", UUID.class),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}

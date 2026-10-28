package ru.teacherbox.homework.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.homework.domain.Assignment;
import ru.teacherbox.homework.domain.quiz.RevealRule;

@Repository
public class AssignmentRepository {

    private static final String SELECT =
            """
            select id, title, description, due_at, board_id, quiz_reveal, quiz_attempts, created_at, updated_at, version
            from homework.assignments""";

    private final JdbcClient jdbc;

    public AssignmentRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Assignment assignment) {
        jdbc.sql("""
                insert into homework.assignments (id, title, description, due_at, quiz_reveal, quiz_attempts, created_at,
                    updated_at, version)
                values (:id, :title, :description, :dueAt, :quizReveal, :quizAttempts, :createdAt, :updatedAt, :version)
                """)
                .param("id", assignment.id())
                .param("title", assignment.title())
                .param("description", assignment.description())
                .param("dueAt", assignment.dueAt())
                .param("quizReveal", assignment.quizReveal().name())
                .param("quizAttempts", assignment.quizAttempts())
                .param("createdAt", assignment.createdAt())
                .param("updatedAt", assignment.updatedAt())
                .param("version", assignment.version())
                .update();
    }

    public void update(Assignment assignment) {
        int updated = jdbc.sql("""
                update homework.assignments
                set title = :title, description = :description, due_at = :dueAt, quiz_reveal = :quizReveal,
                    quiz_attempts = :quizAttempts, updated_at = :updatedAt, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", assignment.id())
                .param("version", assignment.version())
                .param("title", assignment.title())
                .param("description", assignment.description())
                .param("dueAt", assignment.dueAt())
                .param("quizReveal", assignment.quizReveal().name())
                .param("quizAttempts", assignment.quizAttempts())
                .param("updatedAt", assignment.updatedAt())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Assignment " + assignment.id() + " was modified");
        }
        assignment.markSaved(assignment.version() + 1);
    }

    /** The board is not part of the teacher's edits: it changes without a new version. */
    public void delete(UUID id) {
        jdbc.sql("delete from homework.assignments where id = :id").param("id", id).update();
    }

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

    /** Newest first. */
    public List<Assignment> findAll() {
        return jdbc.sql(SELECT + " order by created_at desc").query(AssignmentRepository::map).list();
    }

    private static Assignment map(ResultSet rs, int rowNum) throws SQLException {
        return Assignment.restore(
                rs.getObject("id", UUID.class),
                rs.getString("title"),
                rs.getString("description"),
                rs.getObject("due_at", Instant.class),
                rs.getObject("board_id", UUID.class),
                RevealRule.valueOf(rs.getString("quiz_reveal")),
                rs.getObject("quiz_attempts", Integer.class),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}

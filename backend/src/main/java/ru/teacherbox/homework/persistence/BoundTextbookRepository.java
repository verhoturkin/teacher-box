package ru.teacherbox.homework.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.homework.domain.BoundTextbook;

/** Textbooks bound to assignments. */
@Repository
public class BoundTextbookRepository {

    private static final String SELECT = """
            select assignment_id, textbook_id, pages, bound_at from homework.assignment_textbooks
            """;

    private final JdbcClient jdbc;

    public BoundTextbookRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Binds the textbook, or changes the pages when it is bound already. */
    public void save(BoundTextbook bound) {
        int updated = jdbc.sql("""
                update homework.assignment_textbooks set pages = :pages
                where assignment_id = :assignmentId and textbook_id = :textbookId
                """)
                .param("assignmentId", bound.assignmentId())
                .param("textbookId", bound.textbookId())
                .param("pages", bound.pages())
                .update();
        if (updated == 0) {
            jdbc.sql("""
                    insert into homework.assignment_textbooks (assignment_id, textbook_id, pages, bound_at)
                    values (:assignmentId, :textbookId, :pages, :boundAt)
                    """)
                    .param("assignmentId", bound.assignmentId())
                    .param("textbookId", bound.textbookId())
                    .param("pages", bound.pages())
                    .param("boundAt", bound.boundAt())
                    .update();
        }
    }

    public boolean delete(UUID assignmentId, UUID textbookId) {
        return jdbc.sql("""
                delete from homework.assignment_textbooks where assignment_id = :assignmentId
                and textbook_id = :textbookId
                """)
                .param("assignmentId", assignmentId)
                .param("textbookId", textbookId)
                .update() > 0;
    }

    /** In the order they were bound. */
    public List<BoundTextbook> findByAssignment(UUID assignmentId) {
        return jdbc.sql(SELECT + " where assignment_id = :assignmentId order by bound_at, textbook_id")
                .param("assignmentId", assignmentId)
                .query(BoundTextbookRepository::map)
                .list();
    }

    public Optional<BoundTextbook> find(UUID assignmentId, UUID textbookId) {
        return jdbc.sql(SELECT + " where assignment_id = :assignmentId and textbook_id = :textbookId")
                .param("assignmentId", assignmentId)
                .param("textbookId", textbookId)
                .query(BoundTextbookRepository::map)
                .optional();
    }

    private static BoundTextbook map(ResultSet rs, int rowNum) throws SQLException {
        return new BoundTextbook(rs.getObject("assignment_id", UUID.class), rs.getObject("textbook_id", UUID.class),
                rs.getString("pages"), rs.getObject("bound_at", Instant.class));
    }
}

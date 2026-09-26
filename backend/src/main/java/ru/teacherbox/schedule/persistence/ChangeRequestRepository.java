package ru.teacherbox.schedule.persistence;

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
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.domain.ChangeRequest;
import ru.teacherbox.schedule.domain.RequestStatus;

@Repository
public class ChangeRequestRepository {

    private static final String SELECT = """
            select id, lesson_id, student_id, kind, proposed_starts_at, comment, status, resolution_comment,
                   created_at, resolved_at, version
            from schedule.change_requests
            """;

    private final JdbcClient jdbc;

    public ChangeRequestRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(ChangeRequest request) {
        jdbc.sql("""
                insert into schedule.change_requests (id, lesson_id, student_id, kind, proposed_starts_at, comment,
                    status, resolution_comment, created_at, resolved_at, version)
                values (:id, :lessonId, :studentId, :kind, :proposed, :comment, :status, :resolution, :createdAt,
                    :resolvedAt, :version)
                """)
                .param("id", request.id())
                .param("lessonId", request.lessonId())
                .param("studentId", request.studentId())
                .param("kind", request.kind().name())
                .param("proposed", request.proposedStartsAt())
                .param("comment", request.comment())
                .param("status", request.status().name())
                .param("resolution", request.resolutionComment())
                .param("createdAt", request.createdAt())
                .param("resolvedAt", request.resolvedAt())
                .param("version", request.version())
                .update();
    }

    public void update(ChangeRequest request) {
        int updated = jdbc.sql("""
                update schedule.change_requests
                set status = :status, resolution_comment = :resolution, resolved_at = :resolvedAt,
                    version = version + 1
                where id = :id and version = :version
                """)
                .param("id", request.id())
                .param("version", request.version())
                .param("status", request.status().name())
                .param("resolution", request.resolutionComment())
                .param("resolvedAt", request.resolvedAt())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Request " + request.id() + " was modified");
        }
        request.markSaved(request.version() + 1);
    }

    public Optional<ChangeRequest> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(this::map).optional();
    }

    public Optional<ChangeRequest> findPendingForLesson(UUID lessonId) {
        return jdbc.sql(SELECT + " where lesson_id = :lessonId and status = 'PENDING'")
                .param("lessonId", lessonId)
                .query(this::map)
                .optional();
    }

    public List<ChangeRequest> findPendingForLessons(Collection<UUID> lessonIds) {
        if (lessonIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT + " where lesson_id in (:ids) and status = 'PENDING'")
                .param("ids", lessonIds)
                .query(this::map)
                .list();
    }

    /** Unanswered requests, oldest first. */
    public List<ChangeRequest> findPending() {
        return jdbc.sql(SELECT + " where status = 'PENDING' order by created_at, id").query(this::map).list();
    }

    /** The student's latest requests, newest first. */
    public List<ChangeRequest> findByStudent(UUID studentId, int limit) {
        return jdbc.sql(SELECT + " where student_id = :studentId order by created_at desc, id limit :limit")
                .param("studentId", studentId)
                .param("limit", limit)
                .query(this::map)
                .list();
    }

    private ChangeRequest map(ResultSet rs, int rowNum) throws SQLException {
        return ChangeRequest.restore(
                rs.getObject("id", UUID.class),
                rs.getObject("lesson_id", UUID.class),
                rs.getObject("student_id", UUID.class),
                ChangeKind.valueOf(rs.getString("kind")),
                rs.getObject("proposed_starts_at", Instant.class),
                rs.getString("comment"),
                RequestStatus.valueOf(rs.getString("status")),
                rs.getString("resolution_comment"),
                rs.getObject("created_at", Instant.class),
                rs.getObject("resolved_at", Instant.class),
                rs.getLong("version"));
    }
}

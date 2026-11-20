package ru.teacherbox.identity.persistence;

import java.sql.ResultSet;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Links of guardians to students (ADR-0069). */
@Repository
public class GuardianshipRepository {

    private final JdbcClient jdbc;

    public GuardianshipRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(UUID guardianId, UUID studentId, Instant now) {
        jdbc.sql("""
                insert into identity.guardianships (guardian_id, student_id, created_at)
                values (:guardianId, :studentId, :createdAt)
                """)
                .param("guardianId", guardianId)
                .param("studentId", studentId)
                .param("createdAt", now)
                .update();
    }

    /** @return whether the link existed */
    public boolean delete(UUID guardianId, UUID studentId) {
        return jdbc.sql("delete from identity.guardianships where guardian_id = :guardianId and student_id = :studentId")
                .param("guardianId", guardianId)
                .param("studentId", studentId)
                .update() > 0;
    }

    public boolean exists(UUID guardianId, UUID studentId) {
        return jdbc.sql("""
                select count(*) from identity.guardianships where guardian_id = :guardianId and student_id = :studentId
                """)
                .param("guardianId", guardianId)
                .param("studentId", studentId)
                .query(Integer.class)
                .single() > 0;
    }

    /** Guardians of the student in the order they were linked. */
    public List<UUID> guardiansOf(UUID studentId) {
        return jdbc.sql("""
                select guardian_id from identity.guardianships where student_id = :studentId
                order by created_at, guardian_id
                """)
                .param("studentId", studentId)
                .query(UUID.class)
                .list();
    }

    /** Children of the guardian in the order they were linked, whatever their status. */
    public List<UUID> studentsOf(UUID guardianId) {
        return jdbc.sql("""
                select student_id from identity.guardianships where guardian_id = :guardianId
                order by created_at, student_id
                """)
                .param("guardianId", guardianId)
                .query(UUID.class)
                .list();
    }

    /** Children of each of the guardians in the order they were linked; a guardian without children is absent. */
    public Map<UUID, List<UUID>> studentsOf(Collection<UUID> guardianIds) {
        Map<UUID, List<UUID>> children = new HashMap<>();
        if (guardianIds.isEmpty()) {
            return children;
        }
        jdbc.sql("""
                select guardian_id, student_id from identity.guardianships where guardian_id in (:ids)
                order by created_at, student_id
                """)
                .param("ids", guardianIds)
                .query((ResultSet rs) -> {
                    children.computeIfAbsent(rs.getObject("guardian_id", UUID.class), id -> new ArrayList<>())
                            .add(rs.getObject("student_id", UUID.class));
                });
        return children;
    }
}

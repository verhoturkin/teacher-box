package ru.teacherbox.homework.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The students a draft is meant for; they go with their assignment (cascade). */
@Repository
public class DraftStudentRepository {

    private final JdbcClient jdbc;

    public DraftStudentRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Puts these students in place of the draft's ones. */
    public void replace(UUID assignmentId, Collection<UUID> studentIds) {
        remove(assignmentId, null);
        for (UUID studentId : studentIds) {
            jdbc.sql("insert into homework.assignment_draft_students (assignment_id, student_id) "
                    + "values (:assignmentId, :studentId)")
                    .param("assignmentId", assignmentId)
                    .param("studentId", studentId)
                    .update();
        }
    }

    /** Drops the given students, or every one when {@code studentIds} is {@code null}. */
    public void remove(UUID assignmentId, Collection<UUID> studentIds) {
        if (studentIds == null) {
            jdbc.sql("delete from homework.assignment_draft_students where assignment_id = :assignmentId")
                    .param("assignmentId", assignmentId)
                    .update();
        } else if (!studentIds.isEmpty()) {
            jdbc.sql("delete from homework.assignment_draft_students "
                    + "where assignment_id = :assignmentId and student_id in (:studentIds)")
                    .param("assignmentId", assignmentId)
                    .param("studentIds", studentIds)
                    .update();
        }
    }

    public List<UUID> findByAssignment(UUID assignmentId) {
        return jdbc.sql("select student_id from homework.assignment_draft_students "
                + "where assignment_id = :assignmentId order by student_id")
                .param("assignmentId", assignmentId)
                .query(UUID.class)
                .list();
    }
}

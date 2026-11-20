package ru.teacherbox.billing.persistence;

import java.time.Instant;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The students whose payments only their guardians see (ADR-0069): a row per student, no row — visible. */
@Repository
public class PaymentVisibilityRepository {

    private final JdbcClient jdbc;

    public PaymentVisibilityRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public boolean isGuardiansOnly(UUID studentId) {
        return jdbc.sql("select count(*) from billing.payments_guardians_only where student_id = :studentId")
                .param("studentId", studentId)
                .query(Long.class)
                .single() > 0;
    }

    /** Idempotent: switching it on twice keeps the first time. */
    public void markGuardiansOnly(UUID studentId, Instant now) {
        jdbc.sql("""
                merge into billing.payments_guardians_only (student_id, created_at) key (student_id)
                select :studentId, coalesce(
                    (select created_at from billing.payments_guardians_only where student_id = :studentId), :now)
                """)
                .param("studentId", studentId)
                .param("now", now)
                .update();
    }

    public void clear(UUID studentId) {
        jdbc.sql("delete from billing.payments_guardians_only where student_id = :studentId")
                .param("studentId", studentId)
                .update();
    }
}

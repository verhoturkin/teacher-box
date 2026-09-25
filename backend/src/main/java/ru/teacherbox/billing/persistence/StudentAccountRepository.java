package ru.teacherbox.billing.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.billing.domain.BillingCurrency;
import ru.teacherbox.billing.domain.StudentAccount;

@Repository
public class StudentAccountRepository {

    private static final String SELECT =
            "select student_id, lesson_price, created_at, updated_at, version from billing.student_accounts";

    private final JdbcClient jdbc;
    private final BillingCurrency currency;

    public StudentAccountRepository(JdbcClient jdbc, BillingCurrency currency) {
        this.jdbc = jdbc;
        this.currency = currency;
    }

    public void insert(StudentAccount account) {
        jdbc.sql("""
                insert into billing.student_accounts (student_id, lesson_price, created_at, updated_at, version)
                values (:studentId, :lessonPrice, :createdAt, :updatedAt, :version)
                """)
                .param("studentId", account.studentId())
                .param("lessonPrice", account.lessonPrice().amountMinor())
                .param("createdAt", account.createdAt())
                .param("updatedAt", account.updatedAt())
                .param("version", account.version())
                .update();
    }

    public void update(StudentAccount account) {
        int updated = jdbc.sql("""
                update billing.student_accounts
                set lesson_price = :lessonPrice, updated_at = :updatedAt, version = version + 1
                where student_id = :studentId and version = :version
                """)
                .param("studentId", account.studentId())
                .param("version", account.version())
                .param("lessonPrice", account.lessonPrice().amountMinor())
                .param("updatedAt", account.updatedAt())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Account " + account.studentId() + " was modified");
        }
        account.markSaved(account.version() + 1);
    }

    public Optional<StudentAccount> findById(UUID studentId) {
        return jdbc.sql(SELECT + " where student_id = :studentId")
                .param("studentId", studentId)
                .query(this::map)
                .optional();
    }

    public List<StudentAccount> findAll() {
        return jdbc.sql(SELECT).query(this::map).list();
    }

    private StudentAccount map(ResultSet rs, int rowNum) throws SQLException {
        return StudentAccount.restore(
                rs.getObject("student_id", UUID.class),
                currency.of(rs.getLong("lesson_price")),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}

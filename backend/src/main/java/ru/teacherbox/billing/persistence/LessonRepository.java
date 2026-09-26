package ru.teacherbox.billing.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.billing.domain.BillingCurrency;
import ru.teacherbox.billing.domain.Lesson;
import ru.teacherbox.billing.domain.LessonStatus;

@Repository
public class LessonRepository {

    private static final String SELECT = """
            select id, student_id, lesson_date, duration_minutes, price, topic, status, created_at,
                   cancelled_at, cancel_reason
            from billing.lessons
            """;
    private static final String ORDER = " order by lesson_date desc, created_at desc";

    private final JdbcClient jdbc;
    private final BillingCurrency currency;

    public LessonRepository(JdbcClient jdbc, BillingCurrency currency) {
        this.jdbc = jdbc;
        this.currency = currency;
    }

    public void insert(Lesson lesson) {
        insert(lesson, null);
    }

    /** @param scheduleCompletionId the outcome in the schedule the lesson is charged for */
    public void insert(Lesson lesson, @Nullable UUID scheduleCompletionId) {
        jdbc.sql("""
                insert into billing.lessons (id, student_id, lesson_date, duration_minutes, price, topic, status,
                    created_at, cancelled_at, cancel_reason, schedule_completion_id)
                values (:id, :studentId, :date, :duration, :price, :topic, :status, :createdAt, :cancelledAt,
                    :cancelReason, :scheduleCompletionId)
                """)
                .param("scheduleCompletionId", scheduleCompletionId)
                .param("id", lesson.id())
                .param("studentId", lesson.studentId())
                .param("date", lesson.date())
                .param("duration", lesson.durationMinutes())
                .param("price", lesson.price().amountMinor())
                .param("topic", lesson.topic())
                .param("status", lesson.status().name())
                .param("createdAt", lesson.createdAt())
                .param("cancelledAt", lesson.cancelledAt())
                .param("cancelReason", lesson.cancelReason())
                .update();
    }

    /** Persists a status change (the only mutable part of a lesson). */
    public void updateStatus(Lesson lesson) {
        jdbc.sql("""
                update billing.lessons
                set status = :status, cancelled_at = :cancelledAt, cancel_reason = :cancelReason
                where id = :id
                """)
                .param("id", lesson.id())
                .param("status", lesson.status().name())
                .param("cancelledAt", lesson.cancelledAt())
                .param("cancelReason", lesson.cancelReason())
                .update();
    }

    public Optional<Lesson> findByScheduleCompletion(UUID scheduleCompletionId) {
        return jdbc.sql(SELECT + " where schedule_completion_id = :completionId")
                .param("completionId", scheduleCompletionId)
                .query(this::map)
                .optional();
    }

    public Optional<Lesson> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(this::map).optional();
    }

    public List<Lesson> findByStudent(UUID studentId) {
        return jdbc.sql(SELECT + " where student_id = :studentId" + ORDER)
                .param("studentId", studentId)
                .query(this::map)
                .list();
    }

    /** Lessons with a date in {@code [from, to]}, newest first. */
    public List<Lesson> findBetween(LocalDate from, LocalDate to) {
        return jdbc.sql(SELECT + " where lesson_date between :from and :to" + ORDER)
                .param("from", from)
                .param("to", to)
                .query(this::map)
                .list();
    }

    private Lesson map(ResultSet rs, int rowNum) throws SQLException {
        return Lesson.restore(
                rs.getObject("id", UUID.class),
                rs.getObject("student_id", UUID.class),
                rs.getObject("lesson_date", LocalDate.class),
                rs.getInt("duration_minutes"),
                currency.of(rs.getLong("price")),
                rs.getString("topic"),
                LessonStatus.valueOf(rs.getString("status")),
                rs.getObject("created_at", Instant.class),
                rs.getObject("cancelled_at", Instant.class),
                rs.getString("cancel_reason"));
    }
}

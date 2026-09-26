package ru.teacherbox.schedule.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.domain.Lesson;
import ru.teacherbox.schedule.domain.LessonStatus;

/** Lessons of the schedule (the bean name differs from the billing lesson log). */
@Repository("scheduleLessonRepository")
public class LessonRepository {

    private static final String SELECT = """
            select id, student_id, series_id, series_date, starts_at, duration_minutes, topic, meeting_url, status,
                   cancelled_by, cancel_reason, original_starts_at, completion_id, created_at, updated_at, version
            from schedule.lessons
            """;
    private static final String ORDER = " order by starts_at, id";

    private final JdbcClient jdbc;

    public LessonRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Lesson lesson) {
        jdbc.sql("""
                insert into schedule.lessons (id, student_id, series_id, series_date, starts_at, ends_at,
                    duration_minutes, topic, meeting_url, status, cancelled_by, cancel_reason, original_starts_at,
                    completion_id, created_at, updated_at, version)
                values (:id, :studentId, :seriesId, :seriesDate, :startsAt, :endsAt, :duration, :topic, :meetingUrl,
                    :status, :cancelledBy, :cancelReason, :originalStartsAt, :completionId, :createdAt, :updatedAt,
                    :version)
                """)
                .param("id", lesson.id())
                .param("studentId", lesson.studentId())
                .param("seriesId", lesson.seriesId())
                .param("seriesDate", lesson.seriesDate())
                .param("startsAt", lesson.startsAt())
                .param("endsAt", lesson.endsAt())
                .param("duration", lesson.durationMinutes())
                .param("topic", lesson.topic())
                .param("meetingUrl", lesson.meetingUrl())
                .param("status", lesson.status().name())
                .param("cancelledBy", name(lesson.cancelledBy()))
                .param("cancelReason", lesson.cancelReason())
                .param("originalStartsAt", lesson.originalStartsAt())
                .param("completionId", lesson.completionId())
                .param("createdAt", lesson.createdAt())
                .param("updatedAt", lesson.updatedAt())
                .param("version", lesson.version())
                .update();
    }

    public void update(Lesson lesson) {
        int updated = jdbc.sql("""
                update schedule.lessons
                set starts_at = :startsAt, ends_at = :endsAt, duration_minutes = :duration, topic = :topic,
                    meeting_url = :meetingUrl, status = :status, cancelled_by = :cancelledBy,
                    cancel_reason = :cancelReason, original_starts_at = :originalStartsAt,
                    completion_id = :completionId, updated_at = :updatedAt, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", lesson.id())
                .param("version", lesson.version())
                .param("startsAt", lesson.startsAt())
                .param("endsAt", lesson.endsAt())
                .param("duration", lesson.durationMinutes())
                .param("topic", lesson.topic())
                .param("meetingUrl", lesson.meetingUrl())
                .param("status", lesson.status().name())
                .param("cancelledBy", name(lesson.cancelledBy()))
                .param("cancelReason", lesson.cancelReason())
                .param("originalStartsAt", lesson.originalStartsAt())
                .param("completionId", lesson.completionId())
                .param("updatedAt", lesson.updatedAt())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Lesson " + lesson.id() + " was modified");
        }
        lesson.markSaved(lesson.version() + 1);
    }

    public Optional<Lesson> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(this::map).optional();
    }

    /** Whether any lesson was ever planned. */
    public boolean exists() {
        return jdbc.sql("select count(*) from schedule.lessons").query(Long.class).single() > 0;
    }

    /** The student's nearest scheduled lesson that has not ended at {@code now}. */
    public Optional<Lesson> findNextScheduled(UUID studentId, Instant now) {
        return jdbc.sql(SELECT + " where student_id = :studentId and status = 'SCHEDULED' and ends_at > :now"
                        + ORDER + " limit 1")
                .param("studentId", studentId)
                .param("now", now)
                .query(this::map)
                .optional();
    }

    /** Lessons that start in {@code [from, to)}. */
    public List<Lesson> findStartingBetween(Instant from, Instant to) {
        return jdbc.sql(SELECT + " where starts_at >= :from and starts_at < :to" + ORDER)
                .param("from", from)
                .param("to", to)
                .query(this::map)
                .list();
    }

    public List<Lesson> findStartingBetween(UUID studentId, Instant from, Instant to) {
        return jdbc.sql(SELECT + " where student_id = :studentId and starts_at >= :from and starts_at < :to" + ORDER)
                .param("studentId", studentId)
                .param("from", from)
                .param("to", to)
                .query(this::map)
                .list();
    }

    /** Lessons that are not cancelled and occupy part of {@code [from, to)}. */
    public List<Lesson> findOverlapping(Instant from, Instant to) {
        return jdbc.sql(SELECT + " where status <> 'CANCELLED' and starts_at < :to and ends_at > :from" + ORDER)
                .param("from", from)
                .param("to", to)
                .query(this::map)
                .list();
    }

    /** Planned lessons that start in {@code (after, until]}. */
    public List<Lesson> findScheduledStarting(Instant after, Instant until) {
        return jdbc.sql(SELECT + " where status = 'SCHEDULED' and starts_at > :after and starts_at <= :until" + ORDER)
                .param("after", after)
                .param("until", until)
                .query(this::map)
                .list();
    }

    /** Planned lessons that have ended by {@code before} and still have no outcome. */
    public List<Lesson> findUnmarked(Instant before) {
        return jdbc.sql(SELECT + " where status = 'SCHEDULED' and ends_at <= :before" + ORDER)
                .param("before", before)
                .query(this::map)
                .list();
    }

    /**
     * Removes the planned lessons of a series from {@code from} on, except the ones moved
     * individually (they are arranged separately and stay).
     *
     * @return ids of the removed lessons
     */
    public List<UUID> deleteUntouchedOfSeries(UUID seriesId, LocalDate from) {
        List<UUID> ids = jdbc.sql("""
                select id from schedule.lessons
                where series_id = :seriesId and series_date >= :from and status = 'SCHEDULED'
                  and original_starts_at is null
                """)
                .param("seriesId", seriesId)
                .param("from", from)
                .query(UUID.class)
                .list();
        if (!ids.isEmpty()) {
            jdbc.sql("delete from schedule.lessons where id in (:ids)").param("ids", ids).update();
        }
        return ids;
    }

    public boolean existsForSeriesDate(UUID seriesId, LocalDate date) {
        return jdbc.sql("select count(*) from schedule.lessons where series_id = :seriesId and series_date = :date")
                .param("seriesId", seriesId)
                .param("date", date)
                .query(Long.class)
                .single() > 0;
    }

    /** Remembers the reminders sent for a lesson (one row per advance time in minutes). */
    public void markRemindersSent(UUID lessonId, Collection<Integer> beforeMinutes, Instant now) {
        for (int minutes : beforeMinutes) {
            jdbc.sql("""
                    merge into schedule.reminders_sent (lesson_id, before_minutes, sent_at)
                    key (lesson_id, before_minutes) values (:lessonId, :minutes, :now)
                    """)
                    .param("lessonId", lessonId)
                    .param("minutes", minutes)
                    .param("now", now)
                    .update();
        }
    }

    public List<Integer> remindersSent(UUID lessonId) {
        return jdbc.sql("select before_minutes from schedule.reminders_sent where lesson_id = :lessonId")
                .param("lessonId", lessonId)
                .query(Integer.class)
                .list();
    }

    /** A moved lesson gets its reminders again. */
    public void clearReminders(UUID lessonId) {
        jdbc.sql("delete from schedule.reminders_sent where lesson_id = :lessonId").param("lessonId", lessonId).update();
    }

    private static @Nullable String name(@Nullable Enum<?> value) {
        return value == null ? null : value.name();
    }

    private Lesson map(ResultSet rs, int rowNum) throws SQLException {
        String cancelledBy = rs.getString("cancelled_by");
        return Lesson.restore(
                rs.getObject("id", UUID.class),
                rs.getObject("student_id", UUID.class),
                rs.getObject("series_id", UUID.class),
                rs.getObject("series_date", LocalDate.class),
                rs.getObject("starts_at", Instant.class),
                rs.getInt("duration_minutes"),
                rs.getString("topic"),
                rs.getString("meeting_url"),
                LessonStatus.valueOf(rs.getString("status")),
                cancelledBy == null ? null : CancelledBy.valueOf(cancelledBy),
                rs.getString("cancel_reason"),
                rs.getObject("original_starts_at", Instant.class),
                rs.getObject("completion_id", UUID.class),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}

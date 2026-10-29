package ru.teacherbox.schedule.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.schedule.domain.RepeatRule;

@Repository
public class RepeatRuleRepository {

    private static final String SELECT = """
            select id, student_id, group_id, weekdays, start_time, duration_minutes, interval_weeks, starts_on,
                   ends_on, title, meeting_url, generated_until, created_at, updated_at, version, origin_date
            from schedule.repeat_rules
            """;

    private final JdbcClient jdbc;

    public RepeatRuleRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(RepeatRule series) {
        jdbc.sql("""
                insert into schedule.repeat_rules (id, student_id, group_id, weekdays, start_time, duration_minutes,
                    interval_weeks, starts_on, ends_on, title, meeting_url, generated_until, created_at, updated_at,
                    version, origin_date)
                values (:id, :studentId, :groupId, :weekdays, :startTime, :duration, :interval, :startsOn, :endsOn,
                    :title, :meetingUrl, :generatedUntil, :createdAt, :updatedAt, :version, :originDate)
                """)
                .param("id", series.id())
                .param("studentId", series.studentId())
                .param("groupId", series.groupId())
                .param("weekdays", weekdays(series.weekdays()))
                .param("startTime", series.startTime())
                .param("duration", series.durationMinutes())
                .param("interval", series.intervalWeeks())
                .param("startsOn", series.startsOn())
                .param("endsOn", series.endsOn())
                .param("title", series.title())
                .param("meetingUrl", series.meetingUrl())
                .param("generatedUntil", series.generatedUntil())
                .param("createdAt", series.createdAt())
                .param("updatedAt", series.updatedAt())
                .param("version", series.version())
                .param("originDate", series.originDate())
                .update();
    }

    /** Persists the mutable part: the end date and how far lessons are generated. */
    public void update(RepeatRule series) {
        int updated = jdbc.sql("""
                update schedule.repeat_rules
                set ends_on = :endsOn, generated_until = :generatedUntil, updated_at = :updatedAt,
                    version = version + 1
                where id = :id and version = :version
                """)
                .param("id", series.id())
                .param("version", series.version())
                .param("endsOn", series.endsOn())
                .param("generatedUntil", series.generatedUntil())
                .param("updatedAt", series.updatedAt())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("RepeatRule " + series.id() + " was modified");
        }
        series.markSaved(series.version() + 1);
    }

    public Optional<RepeatRule> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(this::map).optional();
    }

    /** RepeatRule with lessons on or after {@code date} (a series stopped before its start has none). */
    public List<RepeatRule> findActive(LocalDate date) {
        return jdbc.sql(SELECT + " where ends_on is null or (ends_on >= :date and ends_on >= starts_on)"
                        + " order by starts_on, id")
                .param("date", date)
                .query(this::map)
                .list();
    }

    public List<LocalDate> suppressedFrom(UUID id, LocalDate from) {
        return jdbc.sql("select occurrence_date from schedule.repeat_exceptions where rule_id = :id and occurrence_date >= :from")
                .param("id", id).param("from", from).query(LocalDate.class).list();
    }

    private static String weekdays(List<DayOfWeek> days) {
        return days.stream().map(DayOfWeek::name).collect(Collectors.joining(","));
    }

    private static Set<DayOfWeek> weekdays(String days) {
        EnumSet<DayOfWeek> set = EnumSet.noneOf(DayOfWeek.class);
        Arrays.stream(days.split(",")).map(DayOfWeek::valueOf).forEach(set::add);
        return set;
    }

    private RepeatRule map(ResultSet rs, int rowNum) throws SQLException {
        return RepeatRule.restore(
                rs.getObject("id", UUID.class),
                rs.getObject("student_id", UUID.class),
                rs.getObject("group_id", UUID.class),
                weekdays(rs.getString("weekdays")),
                rs.getObject("start_time", LocalTime.class),
                rs.getInt("duration_minutes"),
                rs.getInt("interval_weeks"),
                rs.getObject("starts_on", LocalDate.class),
                rs.getObject("ends_on", LocalDate.class),
                rs.getString("title"),
                rs.getString("meeting_url"),
                rs.getObject("generated_until", LocalDate.class),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version")).continueFrom(rs.getObject("origin_date", LocalDate.class));
    }
}

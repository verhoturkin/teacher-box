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
import org.jspecify.annotations.Nullable;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.schedule.domain.OffTime;
import ru.teacherbox.schedule.domain.OffTime.Once;
import ru.teacherbox.schedule.domain.OffTime.Period;
import ru.teacherbox.schedule.domain.OffTime.Weekly;

@Repository
public class OffTimeRepository {

    private static final String SELECT = """
            select id, kind, starts_at, ends_at, weekdays, start_time, end_time, starts_on, ends_on, note,
                   created_at, updated_at, version
            from schedule.off_times
            """;

    private final JdbcClient jdbc;

    public OffTimeRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(OffTime offTime) {
        Columns columns = Columns.of(offTime.period());
        jdbc.sql("""
                insert into schedule.off_times (id, kind, starts_at, ends_at, weekdays, start_time, end_time,
                    starts_on, ends_on, note, created_at, updated_at, version)
                values (:id, :kind, :startsAt, :endsAt, :weekdays, :startTime, :endTime, :startsOn, :endsOn, :note,
                    :createdAt, :updatedAt, :version)
                """)
                .param("id", offTime.id())
                .param("kind", offTime.period().kind().name())
                .param("startsAt", columns.startsAt())
                .param("endsAt", columns.endsAt())
                .param("weekdays", columns.weekdays())
                .param("startTime", columns.startTime())
                .param("endTime", columns.endTime())
                .param("startsOn", columns.startsOn())
                .param("endsOn", columns.endsOn())
                .param("note", offTime.note())
                .param("createdAt", offTime.createdAt())
                .param("updatedAt", offTime.updatedAt())
                .param("version", offTime.version())
                .update();
    }

    public void update(OffTime offTime) {
        Columns columns = Columns.of(offTime.period());
        int updated = jdbc.sql("""
                update schedule.off_times
                set kind = :kind, starts_at = :startsAt, ends_at = :endsAt, weekdays = :weekdays,
                    start_time = :startTime, end_time = :endTime, starts_on = :startsOn, ends_on = :endsOn,
                    note = :note, updated_at = :updatedAt, version = version + 1
                where id = :id and version = :version
                """)
                .param("id", offTime.id())
                .param("version", offTime.version())
                .param("kind", offTime.period().kind().name())
                .param("startsAt", columns.startsAt())
                .param("endsAt", columns.endsAt())
                .param("weekdays", columns.weekdays())
                .param("startTime", columns.startTime())
                .param("endTime", columns.endTime())
                .param("startsOn", columns.startsOn())
                .param("endsOn", columns.endsOn())
                .param("note", offTime.note())
                .param("updatedAt", offTime.updatedAt())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Off time " + offTime.id() + " was modified");
        }
        offTime.markSaved(offTime.version() + 1);
    }

    public boolean delete(UUID id) {
        return jdbc.sql("delete from schedule.off_times where id = :id").param("id", id).update() == 1;
    }

    public Optional<OffTime> findById(UUID id) {
        return jdbc.sql(SELECT + " where id = :id").param("id", id).query(this::map).optional();
    }

    /** Off time that is not over: weekly first, then once by its start. */
    public List<OffTime> findCurrent(Instant now, LocalDate today) {
        return jdbc.sql(SELECT + """
                 where (kind = 'ONCE' and ends_at > :now)
                    or (kind = 'WEEKLY' and (ends_on is null or ends_on >= :today))
                order by kind desc, starts_at, starts_on, start_time, id
                """)
                .param("now", now)
                .param("today", today)
                .query(this::map)
                .list();
    }

    /**
     * Off time that may overlap {@code [from, to)}: one-time periods that do, weekly ones with days
     * from {@code fromDate} to {@code toDate}.
     */
    public List<OffTime> findOverlapping(Instant from, Instant to, LocalDate fromDate, LocalDate toDate) {
        return jdbc.sql(SELECT + """
                 where (kind = 'ONCE' and starts_at < :to and ends_at > :from)
                    or (kind = 'WEEKLY' and starts_on <= :toDate and (ends_on is null or ends_on >= :fromDate))
                """)
                .param("from", from)
                .param("to", to)
                .param("fromDate", fromDate)
                .param("toDate", toDate)
                .query(this::map)
                .list();
    }

    private OffTime map(ResultSet rs, int rowNum) throws SQLException {
        Period period = switch (OffTime.Kind.valueOf(rs.getString("kind"))) {
            case ONCE -> new Once(rs.getObject("starts_at", Instant.class), rs.getObject("ends_at", Instant.class));
            case WEEKLY -> new Weekly(weekdays(rs.getString("weekdays")),
                    rs.getObject("start_time", LocalTime.class),
                    rs.getObject("end_time", LocalTime.class),
                    rs.getObject("starts_on", LocalDate.class),
                    rs.getObject("ends_on", LocalDate.class));
        };
        return OffTime.restore(
                rs.getObject("id", UUID.class),
                period,
                rs.getString("note"),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }

    private static Set<DayOfWeek> weekdays(String days) {
        EnumSet<DayOfWeek> set = EnumSet.noneOf(DayOfWeek.class);
        Arrays.stream(days.split(",")).map(DayOfWeek::valueOf).forEach(set::add);
        return set;
    }

    /** The columns of one kind of period; the others stay empty. */
    private record Columns(@Nullable Instant startsAt, @Nullable Instant endsAt, @Nullable String weekdays,
            @Nullable LocalTime startTime, @Nullable LocalTime endTime, @Nullable LocalDate startsOn,
            @Nullable LocalDate endsOn) {

        static Columns of(Period period) {
            return switch (period) {
                case Once once -> new Columns(once.startsAt(), once.endsAt(), null, null, null, null, null);
                case Weekly weekly -> new Columns(null, null,
                        weekly.orderedWeekdays().stream().map(DayOfWeek::name).collect(Collectors.joining(",")),
                        weekly.startTime(), weekly.endTime(), weekly.startsOn(), weekly.endsOn());
            };
        }
    }
}

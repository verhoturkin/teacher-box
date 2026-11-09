package ru.teacherbox.schedule.persistence;

import java.time.Instant;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The single row of {@code schedule.settings}: the teacher's lesson rules (ADR-0056). */
@Repository
public class ScheduleSettingsRepository {

    /** A column of the row; an empty value is the default. */
    public enum Setting {
        /** Minutes. */
        DEFAULT_DURATION("default_duration"),
        /** ISO-8601 duration. */
        LATE_CANCELLATION("late_cancellation"),
        /** Comma-separated ISO-8601 durations; {@code ""}: no reminders. */
        REMINDERS("reminders"),
        /** ISO-8601 duration. */
        HORIZON("horizon");

        private final String column;

        Setting(String column) {
            this.column = column;
        }
    }

    private final JdbcClient jdbc;

    public ScheduleSettingsRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** The value as stored; empty until it is set. */
    public Optional<String> find(Setting setting) {
        return jdbc.sql("select " + setting.column + " from schedule.settings where id = 1")
                .query((rs, row) -> Optional.ofNullable(rs.getString(1)))
                .optional()
                .flatMap(value -> value);
    }

    /** Sets the value unless it is set already; {@code false} if it was. */
    public boolean saveIfMissing(Setting setting, Object value, Instant now) {
        jdbc.sql("""
                insert into schedule.settings (id, updated_at, version)
                select 1, :now, 0 where not exists (select 1 from schedule.settings where id = 1)
                """).param("now", now).update();
        return jdbc.sql("update schedule.settings set " + setting.column + " = :value, updated_at = :now,"
                + " version = version + 1 where id = 1 and " + setting.column + " is null")
                .param("value", value)
                .param("now", now)
                .update() == 1;
    }
}

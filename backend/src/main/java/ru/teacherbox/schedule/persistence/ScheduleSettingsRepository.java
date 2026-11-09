package ru.teacherbox.schedule.persistence;

import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;
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

    /** The whole row as stored, each value empty until it is set. */
    public Map<Setting, String> findAll() {
        return jdbc.sql("select default_duration, late_cancellation, reminders, horizon from schedule.settings"
                + " where id = 1")
                .query((rs, row) -> {
                    Map<Setting, String> values = new EnumMap<>(Setting.class);
                    for (Setting setting : Setting.values()) {
                        String value = rs.getString(setting.column);
                        if (value != null) {
                            values.put(setting, value);
                        }
                    }
                    return values;
                })
                .optional()
                .orElseGet(() -> new EnumMap<>(Setting.class));
    }

    /** Replaces every value. */
    public void save(int defaultDuration, String lateCancellation, String reminders, String horizon, Instant now) {
        insertRow(now);
        jdbc.sql("""
                update schedule.settings
                set default_duration = :duration, late_cancellation = :late, reminders = :reminders,
                    horizon = :horizon, updated_at = :now, version = version + 1
                where id = 1
                """)
                .param("duration", defaultDuration)
                .param("late", lateCancellation)
                .param("reminders", reminders)
                .param("horizon", horizon)
                .param("now", now)
                .update();
    }

    /** Sets the value unless it is set already; {@code false} if it was. */
    public boolean saveIfMissing(Setting setting, Object value, Instant now) {
        insertRow(now);
        return jdbc.sql("update schedule.settings set " + setting.column + " = :value, updated_at = :now,"
                + " version = version + 1 where id = 1 and " + setting.column + " is null")
                .param("value", value)
                .param("now", now)
                .update() == 1;
    }

    private void insertRow(Instant now) {
        jdbc.sql("""
                insert into schedule.settings (id, updated_at, version)
                select 1, :now, 0 where not exists (select 1 from schedule.settings where id = 1)
                """).param("now", now).update();
    }
}

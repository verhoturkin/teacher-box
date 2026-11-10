package ru.teacherbox.homework.persistence;

import java.time.Instant;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The single row of {@code homework.settings}: the teacher's homework settings (ADR-0056). */
@Repository
public class HomeworkSettingsRepository {

    /** A column of the row; an empty value is the default. */
    public enum Setting {
        /** ISO-8601 duration before the due date. */
        DUE_SOON_WINDOW("due_soon_window");

        private final String column;

        Setting(String column) {
            this.column = column;
        }
    }

    private final JdbcClient jdbc;

    public HomeworkSettingsRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** The value as stored; empty until it is set. */
    public Optional<String> find(Setting setting) {
        return jdbc.sql("select " + setting.column + " from homework.settings where id = 1")
                .query((rs, row) -> Optional.ofNullable(rs.getString(1)))
                .optional()
                .flatMap(value -> value);
    }

    /** Replaces the value. */
    public void save(Setting setting, Object value, Instant now) {
        insertRow(now);
        jdbc.sql("update homework.settings set " + setting.column + " = :value, updated_at = :now,"
                + " version = version + 1 where id = 1")
                .param("value", value)
                .param("now", now)
                .update();
    }

    /** Sets the value unless it is set already; {@code false} if it was. */
    public boolean saveIfMissing(Setting setting, Object value, Instant now) {
        insertRow(now);
        return jdbc.sql("update homework.settings set " + setting.column + " = :value, updated_at = :now,"
                + " version = version + 1 where id = 1 and " + setting.column + " is null")
                .param("value", value)
                .param("now", now)
                .update() == 1;
    }

    private void insertRow(Instant now) {
        jdbc.sql("""
                insert into homework.settings (id, updated_at, version)
                select 1, :now, 0 where not exists (select 1 from homework.settings where id = 1)
                """).param("now", now).update();
    }
}

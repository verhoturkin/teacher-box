package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import ru.teacherbox.shared.persistence.ModuleMigrations;

class RepeatMigrationTests {
    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3, 4})
    void splitsAllWeekdaysAndKeepsOriginalPhaseAndLessonIdentity(int weeks) {
        String url = "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";
        SingleConnectionDataSource dataSource = new SingleConnectionDataSource(url, "sa", "", true);
        try {
            Flyway.configure().dataSource(dataSource).schemas("SCHEDULE").defaultSchema("SCHEDULE")
                    .locations("classpath:db/migration/schedule").target("1").load().migrate();
            JdbcClient jdbc = JdbcClient.create(dataSource);
            UUID rule = UUID.randomUUID();
            UUID ended = UUID.randomUUID();
            UUID student = UUID.randomUUID();
            UUID lesson = UUID.randomUUID();
            UUID completion = UUID.randomUUID();
            LocalDate start = LocalDate.of(2026, 10, 7); // Wednesday: Monday belongs to the next active phase week.
            LocalDate monday = start.plusDays(5 + (weeks - 1L) * 7);
            Instant moved = Instant.parse("2026-12-01T09:00:00Z");
            for (UUID id : new UUID[] {rule, ended}) {
                jdbc.sql("""
                        insert into schedule.series(id, student_id, weekdays, start_time, duration_minutes,
                          interval_weeks, starts_on, ends_on, generated_until, created_at, updated_at, version)
                        values (:id, :student, 'MONDAY,SATURDAY', '09:00', 60, :weeks, :start, :end, :cursor,
                          timestamp with time zone '2026-10-01 00:00:00Z', timestamp with time zone '2026-10-01 00:00:00Z', 3)
                        """).param("id", id).param("student", student).param("weeks", weeks).param("start", start)
                        .param("end", id.equals(ended) ? start.minusDays(1) : null).param("cursor", start.plusDays(84)).update();
            }
            jdbc.sql("""
                    insert into schedule.lessons(id, series_id, series_date, starts_at, ends_at, duration_minutes,
                      status, original_starts_at, created_at, updated_at, version)
                    values (:id, :rule, :date, :moved, :end, 60, 'CONDUCTED', :original, :created, :moved, 7)
                    """).param("id", lesson).param("rule", rule).param("date", monday).param("moved", moved)
                    .param("end", moved.plusSeconds(3600)).param("original", moved.minusSeconds(86400))
                    .param("created", moved.minusSeconds(86400L * 20)).update();
            jdbc.sql("insert into schedule.lesson_participants(lesson_id, student_id, position, attendance, completion_id) values (:id, :student, 0, 'ATTENDED', :completion)")
                    .param("id", lesson).param("student", student).param("completion", completion).update();
            ModuleMigrations.flyway(dataSource, "schedule").migrate();
            assertThat(jdbc.sql("select count(*) from schedule.repeat_rules").query(Integer.class).single()).isEqualTo(4);
            assertThat(jdbc.sql("select origin_date from schedule.repeat_rules where weekdays = 'MONDAY'").query(LocalDate.class).list())
                    .containsOnly(monday);
            assertThat(jdbc.sql("select interval_weeks from schedule.repeat_rules").query(Integer.class).list()).containsOnly(weeks);
            assertThat(jdbc.sql("select count(*) from schedule.repeat_rules where ends_on < starts_on").query(Integer.class).single()).isEqualTo(2);
            assertThat(jdbc.sql("select starts_at from schedule.lessons where id = :id").param("id", lesson).query(Instant.class).single()).isEqualTo(moved);
            assertThat(jdbc.sql("select series_date from schedule.lessons where id = :id").param("id", lesson).query(LocalDate.class).single()).isEqualTo(monday);
            assertThat(jdbc.sql("select completion_id from schedule.lesson_participants where lesson_id = :id").param("id", lesson).query(UUID.class).single()).isEqualTo(completion);
            assertThat(jdbc.sql("select individually_changed from schedule.lessons where id = :id").param("id", lesson).query(Boolean.class).single()).isTrue();
        } finally {
            dataSource.destroy();
        }
    }
}

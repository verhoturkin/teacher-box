package ru.teacherbox.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import ru.teacherbox.shared.persistence.ModuleMigrations;

/** V8 (stage 454.2): the requests sent before it were the students' own. */
class RequestedByMigrationTests {

    @Test
    void anOldRequestWasSentByTheStudent() {
        String url = "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";
        SingleConnectionDataSource dataSource = new SingleConnectionDataSource(url, "sa", "", true);
        try {
            Flyway.configure().dataSource(dataSource).schemas("SCHEDULE").defaultSchema("SCHEDULE")
                    .locations("classpath:db/migration/schedule").target("7").load().migrate();
            JdbcClient jdbc = JdbcClient.create(dataSource);
            UUID lesson = UUID.randomUUID();
            UUID student = UUID.randomUUID();
            jdbc.sql("""
                    insert into schedule.lessons(id, starts_at, ends_at, duration_minutes, status, created_at,
                      updated_at, version)
                    values (:id, timestamp with time zone '2026-10-01 09:00:00Z',
                      timestamp with time zone '2026-10-01 10:00:00Z', 60, 'SCHEDULED',
                      timestamp with time zone '2026-09-01 00:00:00Z', timestamp with time zone '2026-09-01 00:00:00Z', 0)
                    """).param("id", lesson).update();
            jdbc.sql("""
                    insert into schedule.change_requests(id, lesson_id, student_id, kind, status, created_at, version)
                    values (:id, :lesson, :student, 'CANCEL', 'PENDING', timestamp with time zone '2026-09-02 00:00:00Z', 0)
                    """).param("id", UUID.randomUUID()).param("lesson", lesson).param("student", student).update();

            ModuleMigrations.flyway(dataSource, "schedule").migrate();

            assertThat(jdbc.sql("select requested_by from schedule.change_requests").query(UUID.class).single())
                    .isEqualTo(student);
        } finally {
            dataSource.destroy();
        }
    }
}

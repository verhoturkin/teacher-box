package ru.teacherbox.textbooks;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import ru.teacherbox.shared.persistence.ModuleMigrations;

/** The free-text course of the textbooks becomes a course (ADR-0071, V3). */
class CoursesMigrationTests {

    @Test
    void distinctTrimmedNamesIgnoringCaseTheOldestSpellingWins() {
        String url = "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";
        SingleConnectionDataSource dataSource = new SingleConnectionDataSource(url, "sa", "", true);
        try {
            Flyway.configure().dataSource(dataSource).schemas("TEXTBOOKS").defaultSchema("TEXTBOOKS")
                    .locations("classpath:db/migration/textbooks").target("2").load().migrate();
            JdbcClient jdbc = JdbcClient.create(dataSource);
            Instant start = Instant.parse("2026-10-01T00:00:00Z");
            Map<String, String> ids = new java.util.LinkedHashMap<>();
            String[][] rows = {{"old", " Английский A2 "}, {"newer", "английский a2"}, {"oge", "ОГЭ"},
                    {"blank", "  "}, {"none", null}};
            for (int i = 0; i < rows.length; i++) {
                UUID id = UUID.randomUUID();
                ids.put(rows[i][0], id.toString());
                jdbc.sql("""
                        insert into textbooks.textbooks (id, kind, title, course, format, file_key, filename,
                            content_type, size, created_at, updated_at, version)
                        values (:id, 'TEXTBOOK', 'T', :course, 'PDF', 'k', 'a.pdf', 'application/pdf', 1, :at, :at, 0)
                        """).param("id", id).param("course", rows[i][1]).param("at", start.plusSeconds(i)).update();
            }
            jdbc.sql("insert into textbooks.textbook_members values (:id, 'GROUP', :id)")
                    .param("id", UUID.fromString(ids.get("oge"))).update();

            ModuleMigrations.flyway(dataSource, "textbooks").migrate();

            assertThat(jdbc.sql("select name from textbooks.courses order by position").query(String.class).list())
                    .containsExactly("Английский A2", "ОГЭ");
            assertThat(jdbc.sql("select position from textbooks.courses order by position").query(Integer.class)
                    .list()).containsExactly(0, 1);
            List<String> courseOf = ids.values().stream().map(id -> jdbc.sql("""
                    select coalesce(c.name, '-') from textbooks.textbooks t
                    left join textbooks.courses c on c.id = t.course_id where t.id = :id
                    """).param("id", UUID.fromString(id)).query(String.class).single()).toList();
            assertThat(courseOf).containsExactly("Английский A2", "Английский A2", "ОГЭ", "-", "-");
            jdbc.sql("insert into textbooks.textbook_members values (:id, 'COURSE', :id)")
                    .param("id", UUID.fromString(ids.get("oge"))).update();
            assertThat(jdbc.sql("select count(*) from textbooks.textbook_members").query(Integer.class).single())
                    .isEqualTo(2);
        } finally {
            dataSource.destroy();
        }
    }
}

package ru.teacherbox.shared.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class RecordRowMapperTest {

    enum Status { HELD, PLANNED }

    record Row(UUID id, UUID studentId, Instant startsAt, int minutes, boolean paid, Status status,
            @Nullable Integer score, @Nullable String topic) {
    }

    private JdbcClient jdbc;

    @BeforeEach
    void table() {
        jdbc = JdbcClient.create(new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", ""));
        jdbc.sql("create table lesson(id uuid, student_id uuid, starts_at timestamp with time zone, "
                + "minutes int, paid boolean, status varchar(10), score int, topic varchar(20))").update();
        jdbc.sql("insert into lesson values (random_uuid(), random_uuid(), timestamp with time zone "
                + "'2026-11-16 10:00:00+00', 60, true, 'HELD', 5, 'Past Simple')").update();
        jdbc.sql("insert into lesson values (random_uuid(), random_uuid(), timestamp with time zone "
                + "'2026-11-17 10:00:00+00', null, null, 'PLANNED', null, null)").update();
    }

    @Test
    void snakeCaseColumnsFillTheComponentsIncludingNullsAndPrimitives() {
        List<Row> rows = jdbc.sql("select * from lesson order by starts_at").query(RecordRowMapper.of(Row.class)).list();

        assertThat(rows.get(0)).satisfies(r -> {
            assertThat(r.startsAt()).isEqualTo(Instant.parse("2026-11-16T10:00:00Z"));
            assertThat(r.minutes()).isEqualTo(60);
            assertThat(r.paid()).isTrue();
            assertThat(r.status()).isEqualTo(Status.HELD);
            assertThat(r.score()).isEqualTo(5);
            assertThat(r.topic()).isEqualTo("Past Simple");
        });
        assertThat(rows.get(1)).satisfies(r -> {
            assertThat(r.minutes()).isZero();
            assertThat(r.paid()).isFalse();
            assertThat(r.status()).isEqualTo(Status.PLANNED);
            assertThat(r.score()).isNull();
            assertThat(r.topic()).isNull();
        });
    }

    @Test
    void aliasedAndReorderedColumnsAreMatchedByName() {
        Row row = jdbc.sql("select topic, score, status as \"status\", paid, minutes, starts_at as startsAt, "
                + "student_id as \"studentId\", id from lesson where minutes = 60")
                .query(RecordRowMapper.of(Row.class)).single();

        assertThat(row.topic()).isEqualTo("Past Simple");
        assertThat(row.studentId()).isNotNull();
    }

    @Test
    void aMissingColumnFailsFast() {
        assertThatThrownBy(() -> jdbc.sql("select id, student_id from lesson").query(RecordRowMapper.of(Row.class)).list())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Row.startsAt has no column");
    }
}

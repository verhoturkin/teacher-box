package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import ru.teacherbox.shared.persistence.ModuleMigrations;

/** V5 (stage 469.3): the lesson summary is no longer sent, its notices and muted topic go; nothing else does. */
class LessonSummaryNoticesMigrationTests {

    @Test
    void onlyTheLessonSummaryNoticesAndTopicGo() {
        String url = "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";
        SingleConnectionDataSource dataSource = new SingleConnectionDataSource(url, "sa", "", true);
        try {
            Flyway.configure().dataSource(dataSource).schemas("NOTIFICATIONS").defaultSchema("NOTIFICATIONS")
                    .locations("classpath:db/migration/notifications").target("4").load().migrate();
            JdbcClient jdbc = JdbcClient.create(dataSource);
            UUID student = UUID.randomUUID();
            UUID summary = notice(jdbc, student, "LESSON_SUMMARY");
            UUID homework = notice(jdbc, student, "HOMEWORK_ASSIGNED");
            delivery(jdbc, summary, student);
            delivery(jdbc, homework, student);
            preferences(jdbc, UUID.randomUUID(), "LESSON_SUMMARY");
            preferences(jdbc, UUID.randomUUID(), "BILLING,LESSON_SUMMARY,SCHEDULE");
            preferences(jdbc, UUID.randomUUID(), "HOMEWORK");

            ModuleMigrations.flyway(dataSource, "notifications").migrate();

            assertThat(jdbc.sql("select id from notifications.inbox").query(UUID.class).list())
                    .containsExactly(homework);
            assertThat(jdbc.sql("select notification_id from notifications.deliveries").query(UUID.class).list())
                    .containsExactly(homework);
            assertThat(jdbc.sql("select muted_topics from notifications.preferences order by muted_topics")
                    .query(String.class).list()).containsExactly("", "BILLING,SCHEDULE", "HOMEWORK");
        } finally {
            dataSource.destroy();
        }
    }

    private static UUID notice(JdbcClient jdbc, UUID recipient, String kind) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                insert into notifications.inbox(id, recipient_id, kind, title, created_at)
                values (:id, :recipient, :kind, 'Заголовок', timestamp with time zone '2026-10-01 09:00:00Z')
                """).param("id", id).param("recipient", recipient).param("kind", kind).update();
        return id;
    }

    private static void delivery(JdbcClient jdbc, UUID notification, UUID recipient) {
        jdbc.sql("""
                insert into notifications.deliveries(id, notification_id, recipient_id, channel, external_id, text,
                  status, attempts, next_attempt_at, created_at)
                values (:id, :notification, :recipient, 'TELEGRAM', '1', 'Текст', 'SENT', 1,
                  timestamp with time zone '2026-10-01 09:00:00Z', timestamp with time zone '2026-10-01 09:00:00Z')
                """).param("id", UUID.randomUUID()).param("notification", notification)
                .param("recipient", recipient).update();
    }

    private static void preferences(JdbcClient jdbc, UUID recipient, String muted) {
        jdbc.sql("""
                insert into notifications.preferences(recipient_id, muted_topics, updated_at)
                values (:recipient, :muted, timestamp with time zone '2026-10-01 09:00:00Z')
                """).param("recipient", recipient).param("muted", muted).update();
    }
}

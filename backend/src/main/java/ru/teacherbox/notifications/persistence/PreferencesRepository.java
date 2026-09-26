package ru.teacherbox.notifications.persistence;

import java.time.Instant;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.notifications.domain.NotificationTopic;
import ru.teacherbox.notifications.domain.Preferences;

@Repository
public class PreferencesRepository {

    private final JdbcClient jdbc;

    public PreferencesRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Preferences> find(UUID recipientId) {
        return jdbc.sql("""
                select muted_topics, quiet_from, quiet_to from notifications.preferences
                where recipient_id = :recipientId
                """)
                .param("recipientId", recipientId)
                .query((rs, rowNum) -> new Preferences(topics(rs.getString("muted_topics")),
                        rs.getObject("quiet_from", LocalTime.class), rs.getObject("quiet_to", LocalTime.class)))
                .optional();
    }

    public void save(UUID recipientId, Preferences preferences, Instant now) {
        jdbc.sql("""
                merge into notifications.preferences (recipient_id, muted_topics, quiet_from, quiet_to, updated_at)
                key (recipient_id) values (:recipientId, :muted, :quietFrom, :quietTo, :now)
                """)
                .param("recipientId", recipientId)
                .param("muted", preferences.mutedTopics().stream().sorted().map(Enum::name)
                        .collect(Collectors.joining(",")))
                .param("quietFrom", preferences.quietFrom())
                .param("quietTo", preferences.quietTo())
                .param("now", now)
                .update();
    }

    private static EnumSet<NotificationTopic> topics(String value) {
        EnumSet<NotificationTopic> topics = EnumSet.noneOf(NotificationTopic.class);
        Arrays.stream(value.split(",")).filter(name -> !name.isBlank()).map(NotificationTopic::valueOf)
                .forEach(topics::add);
        return topics;
    }
}

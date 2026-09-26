package ru.teacherbox.notifications.persistence;

import java.time.Instant;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.notifications.domain.ChannelType;

/** Bot tokens entered in the settings page, one row per messenger. */
@Repository
public class ChannelSettingsRepository {

    /**
     * @param groupId VK community id
     * @param botName the bot's name as the messenger reported it when the token was checked
     */
    public record ChannelSettings(ChannelType channel, String token, @Nullable Long groupId, @Nullable String botName,
            Instant updatedAt) {
    }

    private final JdbcClient jdbc;

    public ChannelSettingsRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<ChannelSettings> find(ChannelType channel) {
        return jdbc.sql("""
                select channel, token, group_id, bot_name, updated_at from notifications.channel_settings
                where channel = :channel
                """)
                .param("channel", channel.name())
                .query((rs, rowNum) -> new ChannelSettings(ChannelType.valueOf(rs.getString("channel")),
                        rs.getString("token"), rs.getObject("group_id", Long.class), rs.getString("bot_name"),
                        rs.getObject("updated_at", Instant.class)))
                .optional();
    }

    public void save(ChannelSettings settings) {
        jdbc.sql("""
                merge into notifications.channel_settings (channel, token, group_id, bot_name, updated_at)
                key (channel) values (:channel, :token, :groupId, :botName, :updatedAt)
                """)
                .param("channel", settings.channel().name())
                .param("token", settings.token())
                .param("groupId", settings.groupId())
                .param("botName", settings.botName())
                .param("updatedAt", settings.updatedAt())
                .update();
    }

    public void delete(ChannelType channel) {
        jdbc.sql("delete from notifications.channel_settings where channel = :channel")
                .param("channel", channel.name())
                .update();
    }
}

package ru.teacherbox.notifications.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.notifications.domain.ButtonSet;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.ChatDialog;
import ru.teacherbox.shared.chat.ChatState;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Dialogs with the bots, the buttons of their messages and the bots' settings. */
@Repository
public class ChatRepository {

    private static final TypeReference<Map<String, String>> STATE = new TypeReference<>() {
    };
    private static final TypeReference<List<String>> CHOICES = new TypeReference<>() {
    };

    private final JdbcClient jdbc;
    private final JsonMapper json;

    public ChatRepository(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public Optional<ChatDialog> findDialog(ChannelType channel, String externalId) {
        return jdbc.sql("""
                select channel, external_id, recipient_id, action_id, state, expires_at
                from notifications.chat_dialogs
                where channel = :channel and external_id = :externalId
                """)
                .param("channel", channel.name())
                .param("externalId", externalId)
                .query((rs, row) -> new ChatDialog(ChannelType.valueOf(rs.getString("channel")),
                        rs.getString("external_id"), rs.getObject("recipient_id", UUID.class),
                        rs.getString("action_id"), state(rs.getString("state")), instant(rs, "expires_at")))
                .optional();
    }

    public void saveDialog(ChatDialog dialog, Instant now) {
        jdbc.sql("""
                merge into notifications.chat_dialogs (channel, external_id, recipient_id, action_id, state,
                    expires_at, updated_at)
                key (channel, external_id)
                values (:channel, :externalId, :recipientId, :actionId, :state, :expiresAt, :updatedAt)
                """)
                .param("channel", dialog.channel().name())
                .param("externalId", dialog.externalId())
                .param("recipientId", dialog.recipientId())
                .param("actionId", dialog.actionId())
                .param("state", json.writeValueAsString(dialog.state().values()))
                .param("expiresAt", dialog.expiresAt())
                .param("updatedAt", now)
                .update();
    }

    public void insertButtons(ButtonSet set) {
        jdbc.sql("""
                insert into notifications.chat_buttons (token, recipient_id, channel, external_id, action_id, state,
                    choices, created_at, expires_at)
                values (:token, :recipientId, :channel, :externalId, :actionId, :state, :choices, :createdAt,
                    :expiresAt)
                """)
                .param("token", set.token())
                .param("recipientId", set.recipientId())
                .param("channel", set.channel().name())
                .param("externalId", set.externalId())
                .param("actionId", set.actionId())
                .param("state", json.writeValueAsString(set.state().values()))
                .param("choices", json.writeValueAsString(set.choices()))
                .param("createdAt", set.createdAt())
                .param("expiresAt", set.expiresAt())
                .update();
    }

    /**
     * Removes the set sent to the chat and returns it: a pressed button works only once, even if pressed
     * twice quickly. Buttons of other chats are left alone.
     */
    public Optional<ButtonSet> takeButtons(String token, ChannelType channel, String externalId) {
        Optional<ButtonSet> set = jdbc.sql("""
                select token, recipient_id, channel, external_id, action_id, state, choices, created_at, expires_at
                from notifications.chat_buttons
                where token = :token and channel = :channel and external_id = :externalId
                """)
                .param("token", token)
                .param("channel", channel.name())
                .param("externalId", externalId)
                .query((rs, row) -> new ButtonSet(rs.getString("token"), rs.getObject("recipient_id", UUID.class),
                        ChannelType.valueOf(rs.getString("channel")), rs.getString("external_id"),
                        rs.getString("action_id"), state(rs.getString("state")),
                        json.readValue(rs.getString("choices"), CHOICES), instant(rs, "created_at"),
                        instant(rs, "expires_at")))
                .optional();
        if (set.isEmpty()) {
            return set;
        }
        int removed = jdbc.sql("delete from notifications.chat_buttons where token = :token")
                .param("token", token)
                .update();
        return removed == 1 ? set : Optional.empty();
    }

    /** @return number of removed button sets and dialogs */
    public int deleteExpired(Instant now, Instant dialogsIdleSince) {
        int buttons = jdbc.sql("delete from notifications.chat_buttons where expires_at <= :now")
                .param("now", now)
                .update();
        int dialogs = jdbc.sql("delete from notifications.chat_dialogs where updated_at < :idleSince")
                .param("idleSince", dialogsIdleSince)
                .update();
        return buttons + dialogs;
    }

    /** The teacher may manage the portal through the bot (on unless switched off). */
    public boolean teacherActions() {
        return jdbc.sql("select teacher_actions from notifications.chat_settings where id = 1")
                .query(Boolean.class)
                .optional()
                .orElse(true);
    }

    public void setTeacherActions(boolean enabled, Instant now) {
        jdbc.sql("""
                merge into notifications.chat_settings (id, teacher_actions, updated_at)
                key (id)
                values (1, :enabled, :now)
                """)
                .param("enabled", enabled)
                .param("now", now)
                .update();
    }

    private ChatState state(String text) {
        return new ChatState(json.readValue(text, STATE));
    }

    private static @Nullable Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant();
    }
}

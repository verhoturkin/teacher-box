package ru.teacherbox.notifications.application;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.reset.DataReset;

/**
 * Full reset (ADR-0014): notifications, deliveries, messenger connections, preferences, messages,
 * dialogs with the bots and the bots configured in the settings (those from the environment stay).
 */
@Component
class NotificationsDataReset implements DataReset {

    private static final List<String> TABLES = List.of("notifications.deliveries", "notifications.inbox",
            "notifications.channel_links", "notifications.link_codes", "notifications.channel_settings",
            "notifications.preferences", "notifications.broadcasts", "notifications.chat_dialogs",
            "notifications.chat_buttons", "notifications.chat_settings");

    private final JdbcClient jdbc;
    private final ChannelSettingsService channels;

    NotificationsDataReset(JdbcClient jdbc, ChannelSettingsService channels) {
        this.jdbc = jdbc;
        this.channels = channels;
    }

    @Override
    public List<String> tables() {
        return TABLES;
    }

    @Override
    public void erase() {
        for (String table : TABLES) {
            jdbc.sql("delete from " + table).update();
        }
    }

    @Override
    public Optional<String> afterErase() {
        channels.stopConfigured();
        return Optional.empty();
    }
}

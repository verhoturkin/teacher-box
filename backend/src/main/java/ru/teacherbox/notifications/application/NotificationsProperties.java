package ru.teacherbox.notifications.application;

import java.time.Duration;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings of the notifications module ({@code TEACHERBOX_NOTIFICATIONS_*}). The bots' tokens are the
 * teacher's settings, kept in {@code notifications.channel_settings} (ADR-0056).
 *
 * @param maxAttempts delivery attempts before a message to a messenger is given up
 * @param linkCodeTtl lifetime of a code that connects a messenger account
 */
@ConfigurationProperties("teacherbox.notifications")
public record NotificationsProperties(
        @DefaultValue("8") int maxAttempts,
        @DefaultValue("15m") Duration linkCodeTtl,
        @DefaultValue Telegram telegram,
        @DefaultValue Vk vk,
        @DefaultValue Max max,
        @DefaultValue WebPush webpush) {

    /**
     * Notifications of the browser (ADR-0051).
     *
     * @param subject {@code mailto:} or {@code https:} address that push services may contact the operator
     *                at (VAPID {@code sub}); the portal address when empty
     */
    public record WebPush(@Nullable String subject) {
    }

    /**
     * Telegram Bot API.
     *
     * @param proxy {@code http://host:port} or {@code socks5://host:port} when Telegram is blocked
     *              from the server's network
     */
    public record Telegram(@DefaultValue("https://api.telegram.org") String apiUrl,
            @Nullable String proxy) {
    }

    /** VK API. */
    public record Vk(@DefaultValue("https://api.vk.com") String apiUrl) {
    }

    /** MAX Bot API. */
    public record Max(@DefaultValue("https://platform-api2.max.ru") String apiUrl) {
    }
}

package ru.teacherbox.notifications.application;

import java.time.Duration;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings of the notifications module ({@code TEACHERBOX_NOTIFICATIONS_*}). A messenger is enabled
 * when its token is set.
 *
 * @param publicUrl   address of the portal for links in messenger messages ({@code TEACHERBOX_PUBLIC_URL})
 * @param maxAttempts delivery attempts before a message to a messenger is given up
 * @param linkCodeTtl lifetime of a code that connects a messenger account
 */
@ConfigurationProperties("teacherbox.notifications")
public record NotificationsProperties(
        @Nullable String publicUrl,
        @DefaultValue("8") int maxAttempts,
        @DefaultValue("15m") Duration linkCodeTtl,
        @DefaultValue Telegram telegram,
        @DefaultValue Vk vk,
        @DefaultValue Max max) {

    /** Telegram bot from @BotFather. */
    public record Telegram(@Nullable String botToken, @DefaultValue("https://api.telegram.org") String apiUrl) {
    }

    /**
     * VK community messages: a community access token with the "messages" permission.
     *
     * @param groupId id of the community (the number in {@code club<id>}); empty in .env means not set
     */
    public record Vk(@Nullable String token, @Nullable Long groupId,
            @DefaultValue("https://api.vk.com") String apiUrl) {
    }

    /** Bot of the MAX messenger. */
    public record Max(@Nullable String token, @DefaultValue("https://platform-api2.max.ru") String apiUrl) {
    }
}

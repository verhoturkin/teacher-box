package ru.teacherbox.notifications.telegram;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import ru.teacherbox.notifications.application.MessengerChannel;
import ru.teacherbox.notifications.application.MessengerChannelFactory;
import ru.teacherbox.notifications.application.MessengerHttp;
import ru.teacherbox.notifications.application.NotificationsProperties;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.shared.http.OutboundProxy;

/**
 * Telegram bots: the token from {@code TEACHERBOX_NOTIFICATIONS_TELEGRAM_BOT_TOKEN} or the settings
 * page; requests go through {@code TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY} if it is set.
 */
@Component
class TelegramChannelFactory implements MessengerChannelFactory {

    private static final Logger log = LoggerFactory.getLogger(TelegramChannelFactory.class);

    private final RestClient.Builder builder;
    private final NotificationsProperties.Telegram telegram;
    private final @Nullable OutboundProxy proxy;

    TelegramChannelFactory(RestClient.Builder builder, NotificationsProperties properties) {
        this.builder = builder;
        this.telegram = properties.telegram();
        this.proxy = OutboundProxy.setting("TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY", telegram.proxy());
        if (proxy != null) {
            log.info("Telegram is reached through the proxy {}", proxy);
        }
    }

    @Override
    public ChannelType type() {
        return ChannelType.TELEGRAM;
    }

    @Override
    public @Nullable Credentials fromEnvironment() {
        String token = telegram.botToken();
        return StringUtils.hasText(token) ? new Credentials(token.strip(), null) : null;
    }

    @Override
    public MessengerChannel create(Credentials credentials) {
        if (!StringUtils.hasText(credentials.token())) {
            throw new IllegalArgumentException("The bot token is empty");
        }
        return new TelegramChannel(MessengerHttp.client(builder, telegram.apiUrl(), proxy), credentials.token());
    }
}

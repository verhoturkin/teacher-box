package ru.teacherbox.notifications.telegram;

import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import ru.teacherbox.notifications.application.MessengerChannel;
import ru.teacherbox.notifications.application.MessengerChannelFactory;
import ru.teacherbox.notifications.application.MessengerHttp;
import ru.teacherbox.notifications.application.NotificationsProperties;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.shared.http.OutboundProxy;
import ru.teacherbox.shared.settings.LiveProperties;

/**
 * Telegram bots: the token from the settings page; requests go to {@code TEACHERBOX_NOTIFICATIONS_TELEGRAM_API_URL}
 * through {@code TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY} if it is set. Both are read for every new bot: the
 * administrator changes them without a restart and the bot is started anew (ADR-0056).
 */
@Component
class TelegramChannelFactory implements MessengerChannelFactory {

    private static final Logger log = LoggerFactory.getLogger(TelegramChannelFactory.class);
    private static final String API_URL = "TEACHERBOX_NOTIFICATIONS_TELEGRAM_API_URL";
    private static final String PROXY = "TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY";

    private final RestClient.Builder builder;
    private final LiveProperties<NotificationsProperties> properties;

    TelegramChannelFactory(RestClient.Builder builder, Environment environment) {
        this.builder = builder;
        this.properties = new LiveProperties<>(environment, NotificationsProperties.class);
    }

    @Override
    public ChannelType type() {
        return ChannelType.TELEGRAM;
    }

    @Override
    public Set<String> settings() {
        return Set.of(API_URL, PROXY);
    }

    @Override
    public MessengerChannel create(Credentials credentials) {
        if (!StringUtils.hasText(credentials.token())) {
            throw new IllegalArgumentException("The bot token is empty");
        }
        NotificationsProperties.Telegram telegram = properties.get().telegram();
        OutboundProxy proxy = OutboundProxy.setting(PROXY, telegram.proxy());
        if (proxy != null) {
            log.info("Telegram is reached through the proxy {}", proxy);
        }
        return new TelegramChannel(MessengerHttp.client(builder, telegram.apiUrl(), proxy), credentials.token());
    }
}

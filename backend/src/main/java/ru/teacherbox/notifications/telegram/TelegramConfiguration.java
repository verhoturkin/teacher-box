package ru.teacherbox.notifications.telegram;

import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import ru.teacherbox.notifications.application.MessengerHttp;
import ru.teacherbox.notifications.application.NotificationsProperties;
import ru.teacherbox.shared.http.OutboundProxy;

/** Enabled by {@code TEACHERBOX_NOTIFICATIONS_TELEGRAM_BOT_TOKEN}. */
@Configuration(proxyBeanMethods = false)
@Conditional(TelegramConfiguration.TokenPresent.class)
class TelegramConfiguration {

    private static final Logger log = LoggerFactory.getLogger(TelegramConfiguration.class);

    @Bean
    TelegramChannel telegramChannel(RestClient.Builder builder, NotificationsProperties properties) {
        NotificationsProperties.Telegram telegram = properties.telegram();
        OutboundProxy proxy = OutboundProxy.setting("TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY", telegram.proxy());
        if (proxy != null) {
            log.info("Telegram is reached through the proxy {}", proxy);
        }
        return new TelegramChannel(MessengerHttp.client(builder, telegram.apiUrl(), proxy),
                Objects.requireNonNull(telegram.botToken()).strip());
    }

    static final class TokenPresent implements Condition {

        @Override
        public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
            return StringUtils.hasText(context.getEnvironment().getProperty("teacherbox.notifications.telegram.bot-token"));
        }
    }
}

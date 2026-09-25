package ru.teacherbox.notifications.max;

import java.util.Objects;
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

/** Enabled by {@code TEACHERBOX_NOTIFICATIONS_MAX_TOKEN}. */
@Configuration(proxyBeanMethods = false)
@Conditional(MaxConfiguration.TokenPresent.class)
class MaxConfiguration {

    @Bean
    MaxChannel maxChannel(RestClient.Builder builder, NotificationsProperties properties) {
        NotificationsProperties.Max max = properties.max();
        return new MaxChannel(MessengerHttp.client(builder, max.apiUrl()), Objects.requireNonNull(max.token()).strip());
    }

    static final class TokenPresent implements Condition {

        @Override
        public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
            return StringUtils.hasText(context.getEnvironment().getProperty("teacherbox.notifications.max.token"));
        }
    }
}

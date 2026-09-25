package ru.teacherbox.notifications.vk;

import java.util.Objects;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import ru.teacherbox.notifications.application.MessengerHttp;
import ru.teacherbox.notifications.application.NotificationsProperties;

/** Enabled by {@code TEACHERBOX_NOTIFICATIONS_VK_TOKEN} and {@code TEACHERBOX_NOTIFICATIONS_VK_GROUP_ID}. */
@Configuration(proxyBeanMethods = false)
@Conditional(VkConfiguration.TokenPresent.class)
class VkConfiguration {

    @Bean
    VkChannel vkChannel(RestClient.Builder builder, NotificationsProperties properties) {
        NotificationsProperties.Vk vk = properties.vk();
        return new VkChannel(MessengerHttp.client(builder, vk.apiUrl()), Objects.requireNonNull(vk.token()).strip(),
                Objects.requireNonNull(vk.groupId()));
    }

    static final class TokenPresent implements Condition {

        @Override
        public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
            Environment environment = context.getEnvironment();
            return StringUtils.hasText(environment.getProperty("teacherbox.notifications.vk.token"))
                    && StringUtils.hasText(environment.getProperty("teacherbox.notifications.vk.group-id"));
        }
    }
}

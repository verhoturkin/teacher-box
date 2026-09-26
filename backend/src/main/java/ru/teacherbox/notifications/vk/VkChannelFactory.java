package ru.teacherbox.notifications.vk;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import ru.teacherbox.notifications.application.MessengerChannel;
import ru.teacherbox.notifications.application.MessengerChannelFactory;
import ru.teacherbox.notifications.application.MessengerHttp;
import ru.teacherbox.notifications.application.NotificationsProperties;
import ru.teacherbox.notifications.domain.ChannelType;

/**
 * VK community messages: the community token and id from {@code TEACHERBOX_NOTIFICATIONS_VK_*} or
 * the settings page. VK is always reached directly.
 */
@Component
class VkChannelFactory implements MessengerChannelFactory {

    private final RestClient.Builder builder;
    private final NotificationsProperties.Vk vk;

    VkChannelFactory(RestClient.Builder builder, NotificationsProperties properties) {
        this.builder = builder;
        this.vk = properties.vk();
    }

    @Override
    public ChannelType type() {
        return ChannelType.VK;
    }

    @Override
    public @Nullable Credentials fromEnvironment() {
        String token = vk.token();
        if (!StringUtils.hasText(token)) {
            return null;
        }
        if (vk.groupId() == null) {
            throw new IllegalStateException(
                    "TEACHERBOX_NOTIFICATIONS_VK_GROUP_ID is required together with TEACHERBOX_NOTIFICATIONS_VK_TOKEN");
        }
        return new Credentials(token.strip(), vk.groupId());
    }

    @Override
    public MessengerChannel create(Credentials credentials) {
        Long groupId = credentials.groupId();
        if (!StringUtils.hasText(credentials.token()) || groupId == null || groupId <= 0) {
            throw new IllegalArgumentException("The community token and id are required");
        }
        return new VkChannel(MessengerHttp.client(builder, vk.apiUrl()), credentials.token(), groupId);
    }
}

package ru.teacherbox.notifications.max;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import ru.teacherbox.notifications.application.MessengerChannel;
import ru.teacherbox.notifications.application.MessengerChannelFactory;
import ru.teacherbox.notifications.application.MessengerHttp;
import ru.teacherbox.notifications.application.NotificationsProperties;
import ru.teacherbox.notifications.domain.ChannelType;

/** MAX bots: the token from {@code TEACHERBOX_NOTIFICATIONS_MAX_TOKEN} or the settings page. */
@Component
class MaxChannelFactory implements MessengerChannelFactory {

    private final RestClient.Builder builder;
    private final NotificationsProperties.Max max;

    MaxChannelFactory(RestClient.Builder builder, NotificationsProperties properties) {
        this.builder = builder;
        this.max = properties.max();
    }

    @Override
    public ChannelType type() {
        return ChannelType.MAX;
    }

    @Override
    public @Nullable Credentials fromEnvironment() {
        String token = max.token();
        return StringUtils.hasText(token) ? new Credentials(token.strip(), null) : null;
    }

    @Override
    public MessengerChannel create(Credentials credentials) {
        if (!StringUtils.hasText(credentials.token())) {
            throw new IllegalArgumentException("The bot token is empty");
        }
        return new MaxChannel(MessengerHttp.client(builder, max.apiUrl()), credentials.token());
    }
}

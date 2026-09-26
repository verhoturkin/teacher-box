package ru.teacherbox.notifications.application;

import org.jspecify.annotations.Nullable;
import ru.teacherbox.notifications.domain.ChannelType;

/** Creates the adapter of one messenger from its settings (SPI, one bean per messenger). */
public interface MessengerChannelFactory {

    /**
     * Settings of a bot.
     *
     * @param groupId VK community id (the other messengers do not need it)
     */
    record Credentials(String token, @Nullable Long groupId) {
    }

    ChannelType type();

    /** Settings from environment variables, which take precedence over the settings page. */
    @Nullable Credentials fromEnvironment();

    /**
     * Creates the adapter; no request is made to the messenger yet.
     *
     * @throws IllegalArgumentException if the settings are incomplete
     */
    MessengerChannel create(Credentials credentials);
}

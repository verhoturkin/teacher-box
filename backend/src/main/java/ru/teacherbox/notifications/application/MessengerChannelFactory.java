package ru.teacherbox.notifications.application;

import java.util.Set;
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

    /**
     * The live administrator's settings {@link #create} reads, e.g. a proxy (ADR-0056): when one changes, the
     * bot is created anew.
     */
    default Set<String> settings() {
        return Set.of();
    }

    /**
     * Creates the adapter; no request is made to the messenger yet.
     *
     * @throws IllegalArgumentException if the settings are incomplete
     */
    MessengerChannel create(Credentials credentials);
}

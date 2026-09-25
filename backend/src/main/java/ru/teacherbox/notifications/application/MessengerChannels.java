package ru.teacherbox.notifications.application;

import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import ru.teacherbox.notifications.domain.ChannelType;

/** Configured messengers by type. */
@Component
public class MessengerChannels {

    private final Map<ChannelType, MessengerChannel> byType = new EnumMap<>(ChannelType.class);

    public MessengerChannels(ObjectProvider<MessengerChannel> channels) {
        channels.orderedStream().forEach(channel -> {
            if (byType.putIfAbsent(channel.type(), channel) != null) {
                throw new IllegalStateException("Several adapters for " + channel.type());
            }
        });
    }

    public List<ChannelType> available() {
        return List.copyOf(byType.keySet());
    }

    public boolean isAvailable(ChannelType type) {
        return byType.containsKey(type);
    }

    public Optional<MessengerChannel> find(ChannelType type) {
        return Optional.ofNullable(byType.get(type));
    }

    public Collection<MessengerChannel> all() {
        return List.copyOf(byType.values());
    }
}

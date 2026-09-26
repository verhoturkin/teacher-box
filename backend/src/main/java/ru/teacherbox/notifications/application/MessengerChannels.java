package ru.teacherbox.notifications.application;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import ru.teacherbox.notifications.domain.ChannelType;

/**
 * Messengers that work now, by type. Adapters configured in the settings page or by environment
 * variables are replaced at runtime; adapter beans (fixed) are supported as well.
 */
@Component
public class MessengerChannels {

    private final Map<ChannelType, MessengerChannel> fixed = new EnumMap<>(ChannelType.class);
    private final Map<ChannelType, MessengerChannel> configured = new ConcurrentHashMap<>();

    public MessengerChannels(ObjectProvider<MessengerChannel> beans) {
        beans.orderedStream().forEach(channel -> {
            if (fixed.putIfAbsent(channel.type(), channel) != null) {
                throw new IllegalStateException("Several adapters for " + channel.type());
            }
        });
    }

    /** Uses the adapter for its messenger, replacing the previous one. */
    public void put(MessengerChannel channel) {
        configured.put(channel.type(), channel);
    }

    public void remove(ChannelType type) {
        configured.remove(type);
    }

    public List<ChannelType> available() {
        List<ChannelType> types = new ArrayList<>();
        for (ChannelType type : ChannelType.values()) {
            if (isAvailable(type)) {
                types.add(type);
            }
        }
        return types;
    }

    public boolean isAvailable(ChannelType type) {
        return configured.containsKey(type) || fixed.containsKey(type);
    }

    public Optional<MessengerChannel> find(ChannelType type) {
        MessengerChannel channel = configured.get(type);
        return Optional.ofNullable(channel != null ? channel : fixed.get(type));
    }

    public Collection<MessengerChannel> all() {
        return available().stream().map(type -> find(type).orElseThrow()).toList();
    }
}

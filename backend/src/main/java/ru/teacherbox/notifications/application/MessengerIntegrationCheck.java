package ru.teacherbox.notifications.application;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.shared.diagnostics.IntegrationCheck;

/** Asks every configured bot for its name, through the messenger's proxy if one is set. */
@Component
class MessengerIntegrationCheck implements IntegrationCheck {

    private static final Map<ChannelType, String> NAMES = Map.of(
            ChannelType.TELEGRAM, "Telegram",
            ChannelType.VK, "ВКонтакте",
            ChannelType.MAX, "MAX");

    private final MessengerChannels channels;

    MessengerIntegrationCheck(MessengerChannels channels) {
        this.channels = channels;
    }

    @Override
    public List<IntegrationStatus> check() {
        return Arrays.stream(ChannelType.values()).map(this::check).toList();
    }

    private IntegrationStatus check(ChannelType type) {
        String name = NAMES.get(type);
        return channels.find(type).map(channel -> {
            long started = System.nanoTime();
            try {
                String bot = channel.botName();
                return new IntegrationStatus(name, State.OK, "Бот " + bot + " отвечает", elapsed(started));
            } catch (RuntimeException e) {
                return new IntegrationStatus(name, State.FAILED, String.valueOf(e.getMessage()), elapsed(started));
            }
        }).orElseGet(() -> IntegrationStatus.notConfigured(name, "Бот не подключён"));
    }

    private static long elapsed(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}

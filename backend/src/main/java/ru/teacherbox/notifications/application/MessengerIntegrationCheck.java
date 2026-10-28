package ru.teacherbox.notifications.application;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.shared.diagnostics.IntegrationCheck;
import ru.teacherbox.shared.i18n.Language;

/** Asks every configured bot for its name, through the messenger's proxy if one is set. */
@Component
class MessengerIntegrationCheck implements IntegrationCheck {


    private final MessengerChannels channels;

    MessengerIntegrationCheck(MessengerChannels channels) {
        this.channels = channels;
    }

    @Override
    public List<IntegrationStatus> check() {
        return Arrays.stream(ChannelType.values()).filter(ChannelType::isMessenger).map(this::check).toList();
    }

    /** In the language of the administrator's page (ADR-0036). */
    private IntegrationStatus check(ChannelType type) {
        Language language = Language.current();
        String name = name(type, language);
        return channels.find(type).map(channel -> {
            long started = System.nanoTime();
            try {
                String bot = channel.botName();
                return new IntegrationStatus(name, State.OK, switch (language) {
                    case RU -> "Бот " + bot + " отвечает";
                    case EN -> "Bot " + bot + " answers";
                }, elapsed(started));
            } catch (RuntimeException e) {
                return new IntegrationStatus(name, State.FAILED, String.valueOf(e.getMessage()), elapsed(started));
            }
        }).orElseGet(() -> IntegrationStatus.notConfigured(name, switch (language) {
            case RU -> "Бот не подключён";
            case EN -> "No bot connected";
        }));
    }

    private static String name(ChannelType type, Language language) {
        return switch (type) {
            case TELEGRAM -> "Telegram";
            case VK -> language == Language.RU ? "ВКонтакте" : "VK";
            case MAX -> "MAX";
            case WEB_PUSH -> throw new IllegalArgumentException("Not a messenger: " + type);
        };
    }

    private static long elapsed(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}

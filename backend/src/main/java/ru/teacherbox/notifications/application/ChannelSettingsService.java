package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.notifications.application.MessengerChannelFactory.Credentials;
import ru.teacherbox.notifications.application.NotificationViews.MessengerStatus;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.ChannelSettingsRepository;
import ru.teacherbox.notifications.persistence.ChannelSettingsRepository.ChannelSettings;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.settings.SettingsChanged;

/**
 * Bots of the messengers: the teacher enters the token in the settings page (ADR-0056). A token is checked with the messenger before it is saved, and the new
 * bot starts working without restarting the portal.
 */
@Service
public class ChannelSettingsService implements SmartInitializingSingleton {

    private static final Logger log = LoggerFactory.getLogger(ChannelSettingsService.class);

    /**
     * A messenger as the teacher sets it up.
     *
     * @param botName       the bot's name when it was checked
     * @param teacherLinked the teacher connected their own account
     */
    public record ChannelSetup(
            ChannelType channel,
            boolean configured,
            @Nullable String botName,
            @Nullable Long groupId,
            MessengerStatus connection,
            boolean teacherLinked) {
    }

    private final Map<ChannelType, MessengerChannelFactory> factories = new EnumMap<>(ChannelType.class);
    private final ChannelSettingsRepository settings;
    private final MessengerChannels channels;
    private final MessengerHealth health;
    private final ObjectProvider<MessengerPolling> polling;
    private final ChannelLinkRepository links;
    private final UserDirectory users;
    private final Clock clock;

    public ChannelSettingsService(List<MessengerChannelFactory> factories, ChannelSettingsRepository settings,
            MessengerChannels channels, MessengerHealth health, ObjectProvider<MessengerPolling> polling,
            ChannelLinkRepository links, UserDirectory users, Clock clock) {
        factories.forEach(factory -> this.factories.put(factory.type(), factory));
        this.settings = settings;
        this.channels = channels;
        this.health = health;
        this.polling = polling;
        this.links = links;
        this.users = users;
        this.clock = clock;
    }

    /** Starts the bots configured before, so that polling finds them when it starts. */
    @Override
    public void afterSingletonsInstantiated() {
        for (MessengerChannelFactory factory : factories.values()) {
            settings.find(factory.type()).ifPresent(saved -> channels.put(factory.create(credentials(saved))));
        }
    }

    public List<ChannelSetup> setups() {
        List<ChannelLink> teacherLinks = links.findByRecipient(users.teacherId());
        return factories.values().stream().map(factory -> {
            ChannelType type = factory.type();
            ChannelSettings saved = settings.find(type).orElse(null);
            return new ChannelSetup(type, saved != null,
                    saved == null ? null : saved.botName(), saved == null ? null : saved.groupId(),
                    health.status(type), teacherLinks.stream().anyMatch(link -> link.channel() == type));
        }).toList();
    }

    /**
     * Checks the token with the messenger and starts the bot.
     *
     * @throws BusinessRuleException if the messenger does not accept the token
     */
    public ChannelSetup save(ChannelType type, String token, @Nullable Long groupId) {
        MessengerChannelFactory factory = factory(type);
        Credentials credentials = new Credentials(token.strip(), groupId);
        MessengerChannel channel;
        String botName;
        try {
            channel = factory.create(credentials);
            botName = channel.botName();
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw new BusinessRuleException("notifications.channel-check-failed", String.valueOf(e.getMessage()));
        }
        settings.save(new ChannelSettings(type, credentials.token(), groupId, botName, clock.instant()));
        use(channel);
        log.info("{} bot {} is configured in the settings", type, botName);
        return setup(type);
    }

    /**
     * The administrator changed a messenger's address or proxy (ADR-0056): its bot starts anew with them, as
     * after a new token. A bot that cannot start keeps its settings and reports the error in the log.
     */
    @EventListener
    public void settingsChanged(SettingsChanged changed) {
        for (MessengerChannelFactory factory : factories.values()) {
            ChannelType type = factory.type();
            if (factory.settings().stream().noneMatch(changed.names()::contains)) {
                continue;
            }
            settings.find(type).ifPresent(saved -> {
                try {
                    use(factory.create(credentials(saved)));
                    log.info("{} bot is started anew with the changed settings", type);
                } catch (RuntimeException e) {
                    channels.remove(type);
                    health.reset(type);
                    polling.ifAvailable(running -> running.restart(type));
                    log.warn("{} bot does not start with the changed settings: {}", type, e.getMessage());
                }
            });
        }
    }

    /** Stops the bot configured in the settings page. */
    public void remove(ChannelType type) {
        factory(type);
        settings.delete(type);
        channels.remove(type);
        health.reset(type);
        polling.ifAvailable(running -> running.restart(type));
    }

    /** A full reset (ADR-0014): every bot stops; their settings are gone. */
    public void stopConfigured() {
        for (MessengerChannelFactory factory : factories.values()) {
            channels.remove(factory.type());
            health.reset(factory.type());
            polling.ifAvailable(running -> running.restart(factory.type()));
        }
    }

    /** Sends a test message to the user's own account in the messenger. */
    public void test(ChannelType type, UUID recipientId) {
        MessengerChannel channel = channels.find(type)
                .orElseThrow(() -> new BusinessRuleException("notifications.channel-unavailable",
                        "Messenger " + type + " is not configured"));
        ChannelLink link = links.find(recipientId, type)
                .orElseThrow(() -> new NotFoundException("notifications.channel-not-linked",
                        "Messenger " + type + " is not connected"));
        try {
            channel.send(link.externalId(), NotificationMessages.of(users.language(recipientId)).testMessage());
        } catch (DeliveryException e) {
            throw new BusinessRuleException("notifications.test-failed", String.valueOf(e.getMessage()));
        }
    }

    private void use(MessengerChannel channel) {
        channels.put(channel);
        health.reset(channel.type());
        polling.ifAvailable(running -> running.restart(channel.type()));
    }

    private ChannelSetup setup(ChannelType type) {
        return setups().stream().filter(setup -> setup.channel() == type).findFirst().orElseThrow();
    }

    private MessengerChannelFactory factory(ChannelType type) {
        MessengerChannelFactory factory = factories.get(type);
        if (factory == null) {
            throw new BusinessRuleException("notifications.channel-unavailable", "Messenger " + type + " is not supported");
        }
        return factory;
    }

    private static Credentials credentials(ChannelSettings saved) {
        return new Credentials(saved.token(), saved.groupId());
    }
}

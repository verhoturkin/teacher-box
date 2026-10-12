package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.notifications.application.NotificationViews.ChannelView;
import ru.teacherbox.notifications.application.NotificationViews.LinkCodeView;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.LinkCode;
import ru.teacherbox.notifications.domain.LinkCodes;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.DeliveryRepository;
import ru.teacherbox.notifications.persistence.LinkCodeRepository;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;

/**
 * Connecting messenger accounts: the user gets a one-time code in the portal and sends it to the bot
 * (or opens the bot by a link that already contains the code).
 */
@Service
public class ChannelService {

    static final String UNLINKED = "Messenger disconnected";

    private final MessengerChannels channels;
    private final ChannelLinkRepository links;
    private final LinkCodeRepository codes;
    private final DeliveryRepository deliveries;
    private final NotificationsProperties properties;
    private final UserDirectory users;
    private final Clock clock;

    public ChannelService(MessengerChannels channels, ChannelLinkRepository links, LinkCodeRepository codes,
            DeliveryRepository deliveries, NotificationsProperties properties, UserDirectory users, Clock clock) {
        this.channels = channels;
        this.links = links;
        this.codes = codes;
        this.deliveries = deliveries;
        this.properties = properties;
        this.users = users;
        this.clock = clock;
    }

    /** Messengers configured on this instance and the user's accounts in them. */
    @Transactional(readOnly = true)
    public List<ChannelView> channels(UUID recipientId) {
        List<ChannelLink> linked = links.findByRecipient(recipientId);
        return channels.available().stream()
                .map(type -> linked.stream()
                        .filter(link -> link.channel() == type)
                        .findFirst()
                        .map(ChannelView::of)
                        .orElseGet(() -> ChannelView.notLinked(type)))
                .toList();
    }

    /** Issues a new code; earlier unused codes of the user for this messenger stop working. */
    @Transactional
    public LinkCodeView createLinkCode(UUID recipientId, ChannelType type) {
        MessengerChannel channel = channels.find(type)
                .orElseThrow(() -> new BusinessRuleException("notifications.channel-unavailable",
                        "Messenger " + type + " is not configured"));
        Instant now = clock.instant();
        Instant expiresAt = now.plus(properties.linkCodeTtl());
        String code = LinkCodes.generate();
        codes.deleteStale(recipientId, type, now);
        codes.insert(new LinkCode(LinkCodes.hash(code), recipientId, type, now, expiresAt, null));
        return new LinkCodeView(type, LinkCodes.display(code), expiresAt, channel.chatLink(code).orElse(null));
    }

    /** Pauses or resumes a connected messenger. */
    @Transactional
    public ChannelView setEnabled(UUID recipientId, ChannelType type, boolean enabled) {
        ChannelLink link = links.find(recipientId, type)
                .orElseThrow(() -> new NotFoundException("notifications.channel-not-linked",
                        "Messenger " + type + " is not connected"));
        links.updateEnabled(link.id(), enabled);
        if (!enabled) {
            deliveries.cancelPending(recipientId, type, UNLINKED);
        }
        return ChannelView.of(link.withEnabled(enabled));
    }

    @Transactional
    public void unlink(UUID recipientId, ChannelType type) {
        links.delete(recipientId, type);
        deliveries.cancelPending(recipientId, type, UNLINKED);
    }

    /**
     * Handles a private message to the bot: a code connects the account, {@code /stop} disconnects it.
     *
     * @return the reply to send back, in the language of the chat's account (the teacher's for a chat
     *         not connected yet, ADR-0036)
     */
    @Transactional
    public String handleIncoming(ChannelType type, IncomingMessage message) {
        String text = message.text().strip();
        List<ChannelLink> linked = links.findByExternal(type, message.externalId());
        BotMessages t = BotMessages.of(language(linked));
        if (text.toLowerCase(Locale.ROOT).startsWith("/stop")) {
            for (ChannelLink link : linked) {
                unlink(link.recipientId(), type);
            }
            return linked.isEmpty() ? t.notLinked() : t.stopped();
        }
        Optional<String> code = LinkCodes.find(text);
        if (code.isEmpty()) {
            return linked.isEmpty() ? t.howToConnect() : t.alreadyLinked();
        }
        Instant now = clock.instant();
        String hash = LinkCodes.hash(code.get());
        Optional<LinkCode> linkCode = codes.find(hash, type).filter(candidate -> candidate.isUsable(now));
        if (linkCode.isEmpty() || !codes.markUsed(hash, now)) {
            return t.invalidCode();
        }
        UUID recipient = linkCode.get().recipientId();
        links.save(new ChannelLink(Ids.newId(), recipient, type, message.externalId(), message.displayName(), true,
                now));
        return BotMessages.of(users.language(recipient)).linked();
    }

    /** How to connect, for a chat not connected yet: in the language of the portal, i.e. the teacher's. */
    String howToConnect() {
        return BotMessages.of(language(List.of())).howToConnect();
    }

    /** The language of the chat's first account, or the teacher's for a chat without accounts. */
    private Language language(List<ChannelLink> linked) {
        return users.language(linked.isEmpty() ? users.teacherId() : linked.getFirst().recipientId());
    }
}

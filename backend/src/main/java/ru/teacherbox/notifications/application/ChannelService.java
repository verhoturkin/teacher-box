package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.notifications.application.NotificationViews.ChannelView;
import ru.teacherbox.notifications.application.NotificationViews.LinkCodeView;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.LinkCode;
import ru.teacherbox.notifications.domain.LinkCodes;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.DeliveryRepository;
import ru.teacherbox.notifications.persistence.LinkCodeRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;

/**
 * Connecting messenger accounts: the user gets a one-time code in the portal and sends it to the bot
 * (or opens the bot by a link that already contains the code).
 */
@Service
public class ChannelService {

    static final String REPLY_LINKED =
            "Готово! Уведомления с портала учителя будут приходить сюда. Отключить: /stop";
    static final String REPLY_INVALID_CODE =
            "Код не найден или устарел. Получите новый код в личном кабинете, раздел «Уведомления».";
    static final String REPLY_HELP = "Здравствуйте! Это бот уведомлений портала учителя. Чтобы получать уведомления, "
            + "откройте в личном кабинете раздел «Уведомления», нажмите «Подключить» и отправьте сюда полученный код.";
    static final String REPLY_ALREADY_LINKED =
            "Этот чат получает уведомления с портала учителя. Отключить: /stop";
    static final String REPLY_STOPPED =
            "Уведомления отключены. Подключить снова можно в личном кабинете, раздел «Уведомления».";
    static final String REPLY_NOT_LINKED = "Этот чат не подключён к уведомлениям.";
    static final String UNLINKED = "Messenger disconnected";

    private final MessengerChannels channels;
    private final ChannelLinkRepository links;
    private final LinkCodeRepository codes;
    private final DeliveryRepository deliveries;
    private final NotificationsProperties properties;
    private final Clock clock;

    public ChannelService(MessengerChannels channels, ChannelLinkRepository links, LinkCodeRepository codes,
            DeliveryRepository deliveries, NotificationsProperties properties, Clock clock) {
        this.channels = channels;
        this.links = links;
        this.codes = codes;
        this.deliveries = deliveries;
        this.properties = properties;
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
     * @return the reply to send back
     */
    @Transactional
    public String handleIncoming(ChannelType type, IncomingMessage message) {
        String text = message.text().strip();
        if (text.toLowerCase(Locale.ROOT).startsWith("/stop")) {
            return stop(type, message.externalId());
        }
        Optional<String> code = LinkCodes.find(text);
        if (code.isEmpty()) {
            return links.findByExternal(type, message.externalId()).isEmpty() ? REPLY_HELP : REPLY_ALREADY_LINKED;
        }
        Instant now = clock.instant();
        String hash = LinkCodes.hash(code.get());
        Optional<LinkCode> linkCode = codes.find(hash, type).filter(candidate -> candidate.isUsable(now));
        if (linkCode.isEmpty() || !codes.markUsed(hash, now)) {
            return REPLY_INVALID_CODE;
        }
        links.save(new ChannelLink(Ids.newId(), linkCode.get().recipientId(), type, message.externalId(),
                message.displayName(), true, now));
        return REPLY_LINKED;
    }

    private String stop(ChannelType type, String externalId) {
        List<ChannelLink> linked = links.findByExternal(type, externalId);
        for (ChannelLink link : linked) {
            unlink(link.recipientId(), type);
        }
        return linked.isEmpty() ? REPLY_NOT_LINKED : REPLY_STOPPED;
    }
}

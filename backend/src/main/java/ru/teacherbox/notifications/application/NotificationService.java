package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.notifications.application.NotificationViews.BroadcastView;
import ru.teacherbox.notifications.application.NotificationViews.ChannelView;
import ru.teacherbox.notifications.application.NotificationViews.FailedDelivery;
import ru.teacherbox.notifications.application.NotificationViews.NotificationPage;
import ru.teacherbox.notifications.application.NotificationViews.NotificationView;
import ru.teacherbox.notifications.application.NotificationViews.NotificationsStatus;
import ru.teacherbox.notifications.application.NotificationViews.StudentChannels;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.Delivery;
import ru.teacherbox.notifications.domain.InboxNotification;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.domain.Preferences;
import ru.teacherbox.notifications.persistence.BroadcastRepository;
import ru.teacherbox.notifications.persistence.BroadcastRepository.Broadcast;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.DeliveryRepository;
import ru.teacherbox.notifications.persistence.InboxRepository;
import ru.teacherbox.notifications.persistence.PreferencesRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.time.InstanceTimeZone;

/**
 * Puts notifications into the personal area inbox and schedules their delivery to the recipient's
 * messengers (see {@link DeliveryDispatcher}).
 */
@Service
public class NotificationService {

    /** Messengers limit a message to about 4000 characters. */
    static final int MAX_MESSENGER_TEXT = 4000;
    static final int MAX_PAGE_SIZE = 100;
    static final int FAILED_DELIVERIES = 50;
    static final int BROADCAST_HISTORY = 20;
    static final Duration PROBLEMS_WINDOW = Duration.ofDays(30);
    static final String CONNECT_TITLE = "Подключите мессенджер";
    static final String CONNECT_BODY = "Чтобы получать уведомления в Telegram, ВКонтакте или MAX, откройте раздел "
            + "«Уведомления» и нажмите «Подключить».";

    private final InboxRepository inbox;
    private final ChannelLinkRepository links;
    private final DeliveryRepository deliveries;
    private final MessengerChannels channels;
    private final MessengerHealth health;
    private final PreferencesRepository preferences;
    private final BroadcastRepository broadcasts;
    private final UserDirectory users;
    private final NotificationsProperties properties;
    private final ZoneId zone;
    private final Clock clock;

    public NotificationService(InboxRepository inbox, ChannelLinkRepository links, DeliveryRepository deliveries,
            MessengerChannels channels, MessengerHealth health, PreferencesRepository preferences,
            BroadcastRepository broadcasts, UserDirectory users, NotificationsProperties properties,
            InstanceTimeZone timeZone, Clock clock) {
        this.inbox = inbox;
        this.links = links;
        this.deliveries = deliveries;
        this.channels = channels;
        this.health = health;
        this.preferences = preferences;
        this.broadcasts = broadcasts;
        this.zone = timeZone.zoneId();
        this.users = users;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Notifies a user (the teacher or a student).
     *
     * @param link path inside the portal the notification refers to
     */
    @Transactional
    public InboxNotification notify(UUID recipientId, NotificationKind kind, String title, @Nullable String body,
            @Nullable String link) {
        Instant now = clock.instant();
        InboxNotification notification = InboxNotification.create(Ids.newId(), recipientId, kind, title, body, link,
                now);
        inbox.insert(notification);
        Preferences settings = preferences.find(recipientId).orElse(Preferences.DEFAULT);
        if (mayUseMessengers(recipientId) && settings.sendsToMessengers(kind)) {
            String text = truncate(notification.messengerText(properties.publicUrl()));
            Instant notBefore = settings.deliverAt(now, zone);
            for (ChannelLink channelLink : links.findByRecipient(recipientId)) {
                if (channelLink.enabled() && channels.isAvailable(channelLink.channel())) {
                    deliveries.insert(Delivery.schedule(Ids.newId(), notification.id(), recipientId,
                            channelLink.channel(), channelLink.externalId(), text, now, notBefore));
                }
            }
        }
        return notification;
    }

    /**
     * A message from the teacher to the given students, or to all current students if none are given.
     *
     * @return number of recipients
     */
    @Transactional
    public int broadcast(String title, @Nullable String body, List<UUID> studentIds) {
        List<UUID> recipients = studentIds.isEmpty() ? allCurrentStudents() : currentStudents(studentIds);
        if (recipients.isEmpty()) {
            throw new BusinessRuleException("notification.no-recipients", "There are no students to notify");
        }
        recipients.forEach(id -> notify(id, NotificationKind.MESSAGE, title, body, null));
        broadcasts.insert(new Broadcast(Ids.newId(), title.strip(), body == null || body.isBlank() ? null : body.strip(),
                recipients.size(), clock.instant()));
        return recipients.size();
    }

    /** The teacher's latest messages to students, newest first. */
    @Transactional(readOnly = true)
    public List<BroadcastView> broadcasts() {
        return broadcasts.findLatest(BROADCAST_HISTORY).stream()
                .map(broadcast -> new BroadcastView(broadcast.id(), broadcast.title(), broadcast.body(),
                        broadcast.recipients(), broadcast.createdAt()))
                .toList();
    }

    /** Current students with their connected messengers and recent delivery problems. */
    @Transactional(readOnly = true)
    public List<StudentChannels> studentChannels() {
        Map<UUID, List<ChannelLink>> linked = links.findAll().stream()
                .collect(Collectors.groupingBy(ChannelLink::recipientId));
        Map<UUID, Long> failed = deliveries.failedCountsSince(clock.instant().minus(PROBLEMS_WINDOW));
        return users.currentStudents().stream()
                .sorted(Comparator.comparing(StudentSummary::displayName, String.CASE_INSENSITIVE_ORDER))
                .map(student -> new StudentChannels(student.id(), student.displayName(),
                        linked.getOrDefault(student.id(), List.of()).stream().map(ChannelView::of).toList(),
                        failed.getOrDefault(student.id(), 0L)))
                .toList();
    }

    /**
     * Asks students without a connected messenger to connect one (the given ones, or all of them).
     *
     * @return number of students asked
     */
    @Transactional
    public int remindToConnect(List<UUID> studentIds) {
        Set<UUID> withMessengers = links.findAll().stream().map(ChannelLink::recipientId).collect(Collectors.toSet());
        List<UUID> recipients = (studentIds.isEmpty() ? allCurrentStudents() : currentStudents(studentIds)).stream()
                .filter(id -> !withMessengers.contains(id))
                .toList();
        recipients.forEach(id -> notify(id, NotificationKind.MESSAGE, CONNECT_TITLE, CONNECT_BODY,
                "/cabinet/notifications"));
        return recipients.size();
    }

    @Transactional(readOnly = true)
    public NotificationPage page(UUID recipientId, int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page must be >= 0 and size between 1 and " + MAX_PAGE_SIZE);
        }
        List<NotificationView> items = inbox.findPage(recipientId, Math.multiplyExact(page, size), size).stream()
                .map(NotificationView::of)
                .toList();
        return new NotificationPage(items, inbox.count(recipientId), inbox.countUnread(recipientId));
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID recipientId) {
        return inbox.countUnread(recipientId);
    }

    @Transactional
    public void markRead(UUID recipientId, UUID notificationId) {
        inbox.findById(notificationId)
                .filter(notification -> notification.recipientId().equals(recipientId))
                .orElseThrow(() -> new NotFoundException("notification.not-found", "Notification not found"));
        inbox.markRead(notificationId, clock.instant());
    }

    /** @return number of notifications that were unread */
    @Transactional
    public int markAllRead(UUID recipientId) {
        return inbox.markAllRead(recipientId, clock.instant());
    }

    /** Messengers of this instance and the latest failed deliveries with the recipients' names. */
    @Transactional(readOnly = true)
    public NotificationsStatus status() {
        List<Delivery> failed = deliveries.findFailed(FAILED_DELIVERIES);
        Map<UUID, String> names = users.findStudents(failed.stream().map(Delivery::recipientId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(StudentSummary::id, StudentSummary::displayName));
        List<FailedDelivery> views = failed.stream()
                .map(delivery -> new FailedDelivery(delivery.recipientId(), names.get(delivery.recipientId()),
                        delivery.channel(), delivery.attempts(), delivery.lastError(), delivery.text(),
                        delivery.createdAt()))
                .toList();
        return new NotificationsStatus(channels.available().stream().map(health::status).toList(), views);
    }

    /** Deactivated students keep their inbox but get nothing in messengers. */
    private boolean mayUseMessengers(UUID recipientId) {
        return recipientId.equals(users.teacherId()) || users.isCurrentStudent(recipientId);
    }

    private List<UUID> allCurrentStudents() {
        return users.currentStudents().stream().map(StudentSummary::id).toList();
    }

    private List<UUID> currentStudents(List<UUID> studentIds) {
        Set<UUID> requested = new LinkedHashSet<>(studentIds);
        List<UUID> found = users.findStudents(requested).stream()
                .filter(StudentSummary::isCurrent)
                .map(StudentSummary::id)
                .toList();
        if (found.size() != requested.size()) {
            throw new NotFoundException("student.not-found", "Student not found or deactivated");
        }
        return found;
    }

    private static String truncate(String text) {
        return text.length() <= MAX_MESSENGER_TEXT ? text : text.substring(0, MAX_MESSENGER_TEXT - 1) + "…";
    }
}

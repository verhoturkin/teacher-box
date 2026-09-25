package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.time.Instant;
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
import ru.teacherbox.notifications.application.NotificationViews.FailedDelivery;
import ru.teacherbox.notifications.application.NotificationViews.NotificationPage;
import ru.teacherbox.notifications.application.NotificationViews.NotificationView;
import ru.teacherbox.notifications.application.NotificationViews.NotificationsStatus;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.Delivery;
import ru.teacherbox.notifications.domain.InboxNotification;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.DeliveryRepository;
import ru.teacherbox.notifications.persistence.InboxRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;

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

    private final InboxRepository inbox;
    private final ChannelLinkRepository links;
    private final DeliveryRepository deliveries;
    private final MessengerChannels channels;
    private final MessengerHealth health;
    private final UserDirectory users;
    private final NotificationsProperties properties;
    private final Clock clock;

    public NotificationService(InboxRepository inbox, ChannelLinkRepository links, DeliveryRepository deliveries,
            MessengerChannels channels, MessengerHealth health, UserDirectory users, NotificationsProperties properties, Clock clock) {
        this.inbox = inbox;
        this.links = links;
        this.deliveries = deliveries;
        this.channels = channels;
        this.health = health;
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
        if (mayUseMessengers(recipientId)) {
            String text = truncate(notification.messengerText(properties.publicUrl()));
            for (ChannelLink channelLink : links.findByRecipient(recipientId)) {
                if (channelLink.enabled() && channels.isAvailable(channelLink.channel())) {
                    deliveries.insert(Delivery.schedule(Ids.newId(), notification.id(), recipientId,
                            channelLink.channel(), channelLink.externalId(), text, now));
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

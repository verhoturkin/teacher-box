package ru.teacherbox.notifications.application;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.GuardianSummary;
import ru.teacherbox.identity.api.Guardians;
import ru.teacherbox.identity.api.StudentStatus;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.notifications.application.NotificationViews.BroadcastView;
import ru.teacherbox.notifications.application.NotificationViews.ChannelView;
import ru.teacherbox.notifications.application.NotificationViews.FailedDelivery;
import ru.teacherbox.notifications.application.NotificationViews.NotificationPage;
import ru.teacherbox.notifications.application.NotificationViews.NotificationView;
import ru.teacherbox.notifications.application.NotificationViews.NotificationsStatus;
import ru.teacherbox.notifications.application.NotificationViews.StudentChannels;
import ru.teacherbox.notifications.application.NotificationViews.TeacherNotificationsSummary;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.Delivery;
import ru.teacherbox.notifications.domain.GuardianCategory;
import ru.teacherbox.notifications.domain.InboxNotification;
import ru.teacherbox.notifications.domain.NotificationKind;
import ru.teacherbox.notifications.domain.Preferences;
import ru.teacherbox.notifications.domain.PushSubscription;
import ru.teacherbox.notifications.persistence.BroadcastRepository;
import ru.teacherbox.notifications.persistence.BroadcastRepository.Broadcast;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.DeliveryRepository;
import ru.teacherbox.notifications.persistence.InboxRepository;
import ru.teacherbox.notifications.persistence.PreferencesRepository;
import ru.teacherbox.notifications.persistence.PushSubscriptionRepository;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.notice.NoticeRequested;
import ru.teacherbox.shared.notice.NoticeText;
import ru.teacherbox.shared.portal.Portal;
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
    static final String CHILD_SEPARATOR = " · ";
    /** The pages of the student's cabinet the family cabinet shows too (453.2). */
    static final List<String> FAMILY_PAGES = List.of("schedule", "homework", "billing");

    private final InboxRepository inbox;
    private final ChannelLinkRepository links;
    private final DeliveryRepository deliveries;
    private final MessengerChannels channels;
    private final MessengerHealth health;
    private final PreferencesRepository preferences;
    private final GuardianPreferencesService guardianPreferences;
    private final PushSubscriptionRepository pushSubscriptions;
    private final BroadcastRepository broadcasts;
    private final UserDirectory users;
    private final Guardians guardians;
    private final ChatEngine chat;
    private final KeyboardCodec keyboards;
    private final Portal portal;
    private final InstanceTimeZone timeZone;
    private final Clock clock;

    public NotificationService(InboxRepository inbox, ChannelLinkRepository links, DeliveryRepository deliveries,
            MessengerChannels channels, MessengerHealth health, PreferencesRepository preferences,
            GuardianPreferencesService guardianPreferences, PushSubscriptionRepository pushSubscriptions,
            BroadcastRepository broadcasts, UserDirectory users, Guardians guardians, ChatEngine chat,
            KeyboardCodec keyboards, Portal portal, InstanceTimeZone timeZone, Clock clock) {
        this.inbox = inbox;
        this.links = links;
        this.deliveries = deliveries;
        this.channels = channels;
        this.health = health;
        this.preferences = preferences;
        this.guardianPreferences = guardianPreferences;
        this.pushSubscriptions = pushSubscriptions;
        this.broadcasts = broadcasts;
        this.timeZone = timeZone;
        this.users = users;
        this.guardians = guardians;
        this.chat = chat;
        this.keyboards = keyboards;
        this.portal = portal;
        this.clock = clock;
    }

    /**
     * Notifies a user (the teacher, a student or a guardian).
     *
     * @param link path inside the portal the notification refers to
     */
    @Transactional
    public InboxNotification notify(UUID recipientId, NotificationKind kind, String title, @Nullable String body,
            @Nullable String link) {
        return notify(recipientId, kind, title, body, link, null);
    }

    /**
     * Notifies a user; in messengers, an action of the bot may put its buttons under the message
     * (e.g. «Принять» under a request, ADR-0013).
     *
     * @param subject what the notification is about, for the bot's actions
     */
    @Transactional
    public InboxNotification notify(UUID recipientId, NotificationKind kind, String title, @Nullable String body,
            @Nullable String link, @Nullable ChatSubject subject) {
        return notify(Ids.newId(), recipientId, kind, title, body, link, subject, null);
    }

    /**
     * Notifies the user a module asked to (ADR-0061), in the user's language, and the student's guardians
     * (ADR-0069) by their categories; a guardians-only notice skips the student. Every recipient's record keeps an
     * id derived from the notice, so one delivered again (the event registry resends after a failure or a
     * restart) notifies each of them once.
     */
    @Transactional
    public void notify(NoticeRequested notice) {
        NotificationKind kind = NotificationKind.valueOf(notice.kind());
        if (!notice.guardiansOnly() && inbox.findById(notice.id()).isEmpty()) {
            NoticeText text = notice.text(users.language(notice.recipientId()));
            notify(notice.id(), notice.recipientId(), kind, text.title(), text.body(), notice.link(), notice.subject(),
                    notice.joinUrl());
        }
        Optional<GuardianCategory> category = GuardianCategory.of(kind);
        if (category.isEmpty()) {
            return;
        }
        Optional<StudentSummary> child = users.findStudent(notice.recipientId()).filter(StudentSummary::isCurrent);
        if (child.isEmpty()) {
            return;
        }
        for (GuardianSummary guardian : guardians.guardiansOf(child.get().id())) {
            UUID id = guardianNoticeId(notice.id(), guardian.id());
            if (guardian.status() == StudentStatus.DEACTIVATED
                    || !guardianPreferences.find(guardian.id()).receives(category.get())
                    || inbox.findById(id).isPresent()) {
                continue;
            }
            NoticeText text = notice.text(users.language(guardian.id()));
            // the child's buttons and video room stay the child's: the guardian opens the family cabinet
            notify(id, guardian.id(), kind, childTitle(firstName(child.get().displayName()), text.title()), text.body(),
                    familyLink(child.get().id(), notice.link()), null, null);
        }
    }

    /** The guardian's copy of a notice: the same for every delivery of it, different for each guardian. */
    static UUID guardianNoticeId(UUID noticeId, UUID guardianId) {
        return UUID.nameUUIDFromBytes((noticeId + ":" + guardianId).getBytes(StandardCharsets.UTF_8));
    }

    /** The child's name for the prefix: the first word of the display name («Петя Смирнов» → «Петя»). */
    static String firstName(String displayName) {
        String stripped = displayName.strip();
        int space = stripped.indexOf(' ');
        return space < 0 ? stripped : stripped.substring(0, space);
    }

    /** «Петя · Занятие перенесено»: a guardian of several children sees whose notice it is (ADR-0069). */
    static String childTitle(String child, String title) {
        String named = child.strip() + CHILD_SEPARATOR + title.strip();
        return named.length() <= InboxNotification.MAX_TITLE ? named
                : named.substring(0, InboxNotification.MAX_TITLE - 1) + "…";
    }

    /**
     * The student's page in the family cabinet: {@code /cabinet/schedule?lesson=1} →
     * {@code /family/<child>/schedule?lesson=1}; the child's home for any other page of the student's cabinet.
     */
    static @Nullable String familyLink(UUID childId, @Nullable String link) {
        if (link == null) {
            return null;
        }
        String family = "/family/" + childId;
        for (String page : FAMILY_PAGES) {
            String cabinet = "/cabinet/" + page;
            if (link.equals(cabinet) || link.startsWith(cabinet + "/") || link.startsWith(cabinet + "?")) {
                return family + link.substring("/cabinet".length());
            }
        }
        return family;
    }

    /**
     * In messengers the links go as buttons, not in the text: «Подключиться» to the video room ({@code join}),
     * «Открыть» to the portal page ({@code link}), then the buttons of the bot's actions. The inbox and messengers
     * show the same text.
     */
    private InboxNotification notify(UUID id, UUID recipientId, NotificationKind kind, String title,
            @Nullable String body, @Nullable String link, @Nullable ChatSubject subject, @Nullable String join) {
        Instant now = clock.instant();
        InboxNotification notification = InboxNotification.create(id, recipientId, kind, title, body, link, now);
        inbox.insert(notification);
        Preferences settings = preferences.find(recipientId).orElse(Preferences.DEFAULT);
        if (mayUseMessengers(recipientId) && settings.sendsToMessengers(kind)) {
            String text = truncate(notification.messengerText());
            List<OutgoingButton> linkButtons = linkButtons(recipientId, link, join);
            Instant notBefore = settings.deliverAt(now, zone());
            for (ChannelLink channelLink : links.findByRecipient(recipientId)) {
                if (channelLink.enabled() && channels.isAvailable(channelLink.channel())) {
                    List<List<OutgoingButton>> rows = new ArrayList<>();
                    if (!linkButtons.isEmpty()) {
                        rows.add(linkButtons);
                    }
                    if (subject != null) {
                        rows.addAll(chat.offer(recipientId, channelLink.channel(), channelLink.externalId(),
                                subject));
                    }
                    deliveries.insert(Delivery.schedule(Ids.newId(), notification.id(), recipientId,
                            channelLink.channel(), channelLink.externalId(), text, now, notBefore)
                            .withKeyboard(keyboards.write(rows)));
                }
            }
            // Web push goes with the messengers: one delivery per browser, read from the inbox record when sent.
            for (PushSubscription device : pushSubscriptions.findByUser(recipientId)) {
                deliveries.insert(Delivery.schedule(Ids.newId(), notification.id(), recipientId, ChannelType.WEB_PUSH,
                        device.id().toString(), notification.title(), now, notBefore));
            }
        }
        return notification;
    }

    /** «Подключиться» to the room and «Открыть» the portal page (when the portal address is known). */
    private List<OutgoingButton> linkButtons(UUID recipientId, @Nullable String link, @Nullable String join) {
        NotificationMessages t = NotificationMessages.of(users.language(recipientId));
        List<OutgoingButton> buttons = new ArrayList<>();
        if (join != null) {
            buttons.add(new OutgoingButton(t.join(), null, join));
        }
        if (link != null) {
            portal.link(link).ifPresent(url -> buttons.add(new OutgoingButton(t.open(), null, url)));
        }
        return buttons;
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
                .map(student -> new StudentChannels(student.id(), student.displayName(), student.avatar(),
                        linked.getOrDefault(student.id(), List.of()).stream().map(ChannelView::of).toList(),
                        failed.getOrDefault(student.id(), 0L)))
                .toList();
    }

    /** The messengers of one student, current or deactivated; an unknown student is not found. */
    @Transactional(readOnly = true)
    public StudentChannels studentChannels(UUID studentId) {
        StudentSummary student = users.findStudent(studentId)
                .orElseThrow(() -> new NotFoundException("notifications.student-not-found", "Student not found"));
        return new StudentChannels(student.id(), student.displayName(), student.avatar(),
                links.findByRecipient(studentId).stream().map(ChannelView::of).toList(),
                deliveries.failedCountsSince(clock.instant().minus(PROBLEMS_WINDOW)).getOrDefault(studentId, 0L));
    }

    @Transactional(readOnly = true)
    public TeacherNotificationsSummary teacherSummary() {
        List<StudentChannels> students = studentChannels();
        long failed = deliveries.failedCountsSince(clock.instant().minus(PROBLEMS_WINDOW)).values().stream()
                .mapToLong(Long::longValue)
                .sum();
        return new TeacherNotificationsSummary(failed, !channels.available().isEmpty(), students.size(),
                Math.toIntExact(students.stream().filter(student -> !student.channels().isEmpty()).count()));
    }

    /**
     * Asks students without a connected messenger to connect one (the given ones, or all of them), each in
     * their language.
     *
     * @return number of students asked
     */
    @Transactional
    public int remindToConnect(List<UUID> studentIds) {
        Set<UUID> withMessengers = links.findAll().stream().map(ChannelLink::recipientId).collect(Collectors.toSet());
        List<UUID> recipients = (studentIds.isEmpty() ? allCurrentStudents() : currentStudents(studentIds)).stream()
                .filter(id -> !withMessengers.contains(id))
                .toList();
        for (UUID id : recipients) {
            NotificationMessages t = NotificationMessages.of(users.language(id));
            notify(id, NotificationKind.MESSAGE, t.connectTitle(), t.connectBody(), "/cabinet/account");
        }
        return recipients.size();
    }

    /**
     * A page of the inbox, newest first; {@code total} counts the notifications of the filter.
     *
     * @param read {@code true} — only read ones, {@code false} — only unread ones, {@code null} — all
     */
    @Transactional(readOnly = true)
    public NotificationPage page(UUID recipientId, Boolean read, int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page must be >= 0 and size between 1 and " + MAX_PAGE_SIZE);
        }
        List<NotificationView> items = inbox.findPage(recipientId, read, Math.multiplyExact(page, size), size)
                .stream()
                .map(NotificationView::of)
                .toList();
        return new NotificationPage(items, inbox.count(recipientId, read), inbox.countUnread(recipientId));
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

    /**
     * Deactivated students keep their inbox but get nothing in messengers; nor does a guardian without current
     * children (ADR-0069).
     */
    private boolean mayUseMessengers(UUID recipientId) {
        return recipientId.equals(users.teacherId()) || users.isCurrentStudent(recipientId)
                || !guardians.childrenOf(recipientId).isEmpty();
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

    /** The instance time zone, read per call: the teacher may change it at any time. */
    private ZoneId zone() {
        return timeZone.zoneId();
    }
}

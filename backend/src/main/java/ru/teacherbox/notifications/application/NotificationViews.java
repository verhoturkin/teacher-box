package ru.teacherbox.notifications.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.InboxNotification;
import ru.teacherbox.notifications.domain.NotificationKind;

/** Read models of the notifications API. */
public final class NotificationViews {

    private NotificationViews() {
    }

    public record NotificationView(
            UUID id,
            NotificationKind kind,
            String title,
            @Nullable String body,
            @Nullable String link,
            Instant createdAt,
            boolean read) {

        static NotificationView of(InboxNotification notification) {
            return new NotificationView(notification.id(), notification.kind(), notification.title(),
                    notification.body(), notification.link(), notification.createdAt(), notification.isRead());
        }
    }

    public record NotificationPage(List<NotificationView> items, long total, long unread) {
    }

    public record UnreadCount(long count) {
    }

    /** A messenger available on this instance and whether the user connected it. */
    public record ChannelView(
            ChannelType channel,
            boolean linked,
            @Nullable String displayName,
            boolean enabled,
            @Nullable Instant linkedAt) {

        static ChannelView notLinked(ChannelType channel) {
            return new ChannelView(channel, false, null, false, null);
        }

        static ChannelView of(ChannelLink link) {
            return new ChannelView(link.channel(), true, link.displayName(), link.enabled(), link.linkedAt());
        }
    }

    /**
     * A code to send to the bot.
     *
     * @param code display form of the code, e.g. {@code ABCD-2345}
     * @param url  link that opens the bot (with the code when the messenger supports it)
     */
    public record LinkCodeView(ChannelType channel, String code, Instant expiresAt, @Nullable String url) {
    }

    /**
     * A message that could not be delivered to a messenger.
     *
     * @param recipientName student name, or {@code null} for the teacher
     */
    public record FailedDelivery(
            UUID recipientId,
            @Nullable String recipientName,
            ChannelType channel,
            int attempts,
            @Nullable String error,
            String text,
            Instant createdAt) {
    }

    /** State of the connection to a messenger API. */
    public enum Connection {
        /** No request has completed yet (just started, or message receiving is off). */
        PENDING,
        OK,
        ERROR
    }

    /**
     * @param error     why the latest request failed
     * @param checkedAt when the latest request completed
     */
    public record MessengerStatus(ChannelType channel, Connection connection, @Nullable String error,
            @Nullable Instant checkedAt) {
    }

    /** Messengers configured on the server and recent delivery problems (for the teacher). */
    public record NotificationsStatus(List<MessengerStatus> channels, List<FailedDelivery> failedDeliveries) {
    }

    public record BroadcastResult(int recipients) {
    }
}

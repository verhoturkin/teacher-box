package ru.teacherbox.notifications.domain;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * A notification in the personal area.
 *
 * @param link path inside the portal the notification refers to (e.g. {@code /cabinet/homework/<id>})
 */
public record InboxNotification(
        UUID id,
        UUID recipientId,
        NotificationKind kind,
        String title,
        @Nullable String body,
        @Nullable String link,
        Instant createdAt,
        @Nullable Instant readAt) {

    public static final int MAX_TITLE = 300;
    public static final int MAX_BODY = 4000;

    public static InboxNotification create(UUID id, UUID recipientId, NotificationKind kind, String title,
            @Nullable String body, @Nullable String link, Instant now) {
        String trimmedTitle = title.strip();
        if (trimmedTitle.isEmpty() || trimmedTitle.length() > MAX_TITLE) {
            throw new BusinessRuleException("notification.title-invalid", "Title must be 1-" + MAX_TITLE + " characters");
        }
        String trimmedBody = body == null || body.isBlank() ? null : body.strip();
        if (trimmedBody != null && trimmedBody.length() > MAX_BODY) {
            throw new BusinessRuleException("notification.body-invalid", "Text is too long");
        }
        return new InboxNotification(id, recipientId, kind, trimmedTitle, trimmedBody, link, now, null);
    }

    public boolean isRead() {
        return readAt != null;
    }

    /** Plain text for messengers: title, body and an absolute link when the public URL is known. */
    public String messengerText(@Nullable String publicUrl) {
        StringBuilder text = new StringBuilder(title);
        if (body != null) {
            text.append("\n").append(body);
        }
        if (publicUrl != null && !publicUrl.isBlank() && link != null) {
            text.append("\n").append(publicUrl.replaceAll("/+$", "")).append(link);
        }
        return text.toString();
    }
}

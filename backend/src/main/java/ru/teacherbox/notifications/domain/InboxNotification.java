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

    /**
     * Plain text for messengers: the title and the body ({@code body} replaces the stored one, e.g. without a link
     * that goes as a button). The portal link goes as an «Открыть» button, not in the text.
     */
    public String messengerText(@Nullable String body) {
        return body == null || body.isBlank() ? title : title + "\n" + body.strip();
    }
}

package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import ru.teacherbox.notifications.domain.Delivery;
import ru.teacherbox.notifications.domain.InboxNotification;
import ru.teacherbox.notifications.persistence.InboxRepository;
import ru.teacherbox.notifications.persistence.PushSubscriptionRepository;
import ru.teacherbox.notifications.webpush.PushTarget;
import ru.teacherbox.notifications.webpush.WebPushSender;
import ru.teacherbox.shared.portal.Portal;
import tools.jackson.databind.json.JsonMapper;

/**
 * Sends a delivery of the web push channel to one device (ADR-0051): the delivery's {@code externalId} is the
 * subscription. The message is the title, the text and the link of the inbox record, nothing else, in the
 * format of the Angular service worker ({@code ngsw}), which shows it by itself.
 */
@Component
class PushChannel {

    /** A device that is off gets the message for a day, then it is not news any more. */
    static final Duration TTL = Duration.ofDays(1);
    private static final int MAX_BODY = 200;

    private final PushSubscriptionRepository subscriptions;
    private final InboxRepository inbox;
    private final WebPushSender sender;
    private final Portal portal;
    private final JsonMapper json;
    private final Clock clock;

    PushChannel(PushSubscriptionRepository subscriptions, InboxRepository inbox, WebPushSender sender, Portal portal,
            JsonMapper json, Clock clock) {
        this.subscriptions = subscriptions;
        this.inbox = inbox;
        this.sender = sender;
        this.portal = portal;
        this.json = json;
        this.clock = clock;
    }

    /**
     * A device that is gone (unsubscribed, or the push service says so) is not a failure: there is nobody to
     * tell, so the delivery ends quietly and a dead subscription is deleted.
     *
     * @throws DeliveryException the push service did not take the message; permanent when retrying is pointless
     */
    void send(Delivery delivery) {
        UUID id = UUID.fromString(delivery.externalId());
        var subscription = subscriptions.findById(id).orElse(null);
        if (subscription == null) {
            return;
        }
        InboxNotification notification = inbox.findById(delivery.notificationId())
                .orElseThrow(() -> new DeliveryException("The notification is gone", true));
        Base64.Decoder base64 = Base64.getUrlDecoder();
        WebPushSender.Result result = sender.send(new PushTarget(subscription.endpoint(),
                base64.decode(subscription.p256dh()), base64.decode(subscription.auth())),
                payload(notification), TTL, null);
        switch (result.outcome()) {
            case SENT -> subscriptions.markSuccess(id, clock.instant());
            case GONE -> subscriptions.delete(id);
            case RETRY -> {
                subscriptions.markFailure(id);
                throw new DeliveryException("Push service answered " + result.status(), false);
            }
            case REJECTED -> {
                subscriptions.markFailure(id);
                throw new DeliveryException("Push service refused the message: " + result.status(), true);
            }
        }
    }

    /**
     * {@code onActionClick} is what {@code ngsw} reads on a click: it opens the page of the notification.
     * The link is absolute when the portal address is known, else a path of the portal itself.
     */
    private byte[] payload(InboxNotification notification) {
        String path = notification.link() == null ? "/" : notification.link();
        String url = portal.link(path).orElse(path);
        Map<String, Object> shown = new LinkedHashMap<>();
        shown.put("title", notification.title());
        if (notification.body() != null) {
            shown.put("body", shorten(notification.body()));
        }
        shown.put("tag", notification.id().toString());
        shown.put("data", Map.of("url", url,
                "onActionClick", Map.of("default", Map.of("operation", "navigateLastFocusedOrOpen", "url", url))));
        return json.writeValueAsBytes(Map.of("notification", shown));
    }

    private static String shorten(String text) {
        return text.length() <= MAX_BODY ? text : text.substring(0, MAX_BODY - 1) + "…";
    }
}

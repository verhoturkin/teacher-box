package ru.teacherbox.notifications.application;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.notifications.domain.PushSubscription;
import ru.teacherbox.notifications.persistence.PushSubscriptionRepository;
import ru.teacherbox.notifications.persistence.PushSubscriptionRepository.Counts;
import ru.teacherbox.notifications.webpush.VapidKeyStore;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.i18n.Language;

/** The browsers of a user that get web push (ADR-0051): a user sees and removes only their own. */
@Service
public class PushSubscriptionService {

    static final int MAX_ENDPOINT = 1000;
    static final int MAX_USER_AGENT = 200;
    private static final int P256DH_BYTES = 65;
    private static final int AUTH_BYTES = 16;

    /** A device without its address at the push service: that address is a secret of the device. */
    public record DeviceView(UUID id, @Nullable String userAgent, Instant createdAt, @Nullable Instant lastSuccessAt,
            boolean failing) {

        static DeviceView of(PushSubscription subscription) {
            return new DeviceView(subscription.id(), subscription.userAgent(), subscription.createdAt(),
                    subscription.lastSuccessAt(), subscription.failures() > 0);
        }
    }

    /** For the administrator: numbers only, no users and no addresses. */
    public record PushCounts(long subscriptions, long failing) {
    }

    private final PushSubscriptionRepository subscriptions;
    private final VapidKeyStore keys;
    private final Clock clock;

    public PushSubscriptionService(PushSubscriptionRepository subscriptions, VapidKeyStore keys, Clock clock) {
        this.subscriptions = subscriptions;
        this.keys = keys;
        this.clock = clock;
    }

    /** The public VAPID key the browser subscribes with. */
    public String publicKey() {
        return keys.publicKey();
    }

    @Transactional(readOnly = true)
    public List<DeviceView> devices(UUID userId) {
        return subscriptions.findByUser(userId).stream().map(DeviceView::of).toList();
    }

    /** Subscribing the same browser again replaces its keys (and its owner, if another user signed in there). */
    @Transactional
    public DeviceView subscribe(UUID userId, String endpoint, String p256dh, String auth,
            @Nullable String userAgent) {
        validate(endpoint, p256dh, auth);
        subscriptions.save(new PushSubscription(Ids.newId(), userId, endpoint, p256dh, auth,
                userAgent == null || userAgent.isBlank() ? null : truncate(userAgent.strip()),
                Language.current().code(), clock.instant(), null, 0));
        return DeviceView.of(subscriptions.findByEndpoint(endpoint).orElseThrow());
    }

    @Transactional
    public void unsubscribe(UUID userId, UUID id) {
        subscriptions.findById(id)
                .filter(subscription -> subscription.userId().equals(userId))
                .orElseThrow(() -> new NotFoundException("push.subscription-not-found", "Device not found"));
        subscriptions.delete(id);
    }

    @Transactional(readOnly = true)
    public PushCounts counts() {
        Counts counts = subscriptions.counts();
        return new PushCounts(counts.subscriptions(), counts.failing());
    }

    private static void validate(String endpoint, String p256dh, String auth) {
        try {
            URI uri = URI.create(endpoint);
            if (endpoint.length() > MAX_ENDPOINT || uri.getHost() == null || !"https".equals(uri.getScheme())
                    || Base64.getUrlDecoder().decode(p256dh).length != P256DH_BYTES
                    || Base64.getUrlDecoder().decode(auth).length != AUTH_BYTES) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException e) {
            throw new BusinessRuleException("push.subscription-invalid", "The subscription is not valid");
        }
    }

    private static String truncate(String text) {
        return text.length() <= MAX_USER_AGENT ? text : text.substring(0, MAX_USER_AGENT);
    }
}

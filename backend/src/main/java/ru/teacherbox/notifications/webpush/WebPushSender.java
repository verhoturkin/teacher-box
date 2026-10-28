package ru.teacherbox.notifications.webpush;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import ru.teacherbox.notifications.application.NotificationsProperties;
import ru.teacherbox.shared.portal.Portal;

/** Hands an encrypted message to the push service of a device (RFC 8030) with the VAPID proof (RFC 8292). */
@Component
public class WebPushSender {

    /** What the push service answered, in terms of what the caller does next. */
    public enum Outcome {
        /** The push service accepted the message. */
        SENT,
        /** The subscription no longer exists (404, 410): delete it. */
        GONE,
        /** A failure that may pass (429, 5xx, no connection): try again later. */
        RETRY,
        /** The push service refused the message for good (other 4xx, a bad address or key). */
        REJECTED
    }

    /** @param status the HTTP status, 0 when there was no answer */
    public record Result(Outcome outcome, int status) {
    }

    private static final Logger log = LoggerFactory.getLogger(WebPushSender.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(20);

    private final VapidKeyStore keys;
    private final Portal portal;
    private final NotificationsProperties properties;
    private final HttpClient client;
    private final boolean httpsOnly;

    @Autowired
    WebPushSender(VapidKeyStore keys, Portal portal, NotificationsProperties properties) {
        this(keys, portal, properties, HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10)).build(), true);
    }

    /** For tests: a local server speaks plain HTTP. */
    WebPushSender(VapidKeyStore keys, Portal portal, NotificationsProperties properties, HttpClient client,
            boolean httpsOnly) {
        this.keys = keys;
        this.portal = portal;
        this.properties = properties;
        this.client = client;
        this.httpsOnly = httpsOnly;
    }

    /**
     * Encrypts {@code payload} for the device and posts it.
     *
     * @param ttl   how long the push service keeps the message for a device that is off
     * @param topic collapses a waiting message with the same topic (up to 32 characters of base64url), or null
     */
    public Result send(PushTarget target, byte[] payload, Duration ttl, @Nullable String topic) {
        URI endpoint;
        byte[] body;
        try {
            endpoint = URI.create(target.endpoint());
            if (endpoint.getHost() == null || httpsOnly && !"https".equals(endpoint.getScheme())) {
                return new Result(Outcome.REJECTED, 0);
            }
            body = WebPushCrypto.encrypt(payload, target.p256dh(), target.auth());
        } catch (IllegalArgumentException e) {
            log.warn("Push message not sent: {}", e.getMessage());
            return new Result(Outcome.REJECTED, 0);
        }
        HttpRequest.Builder request = HttpRequest.newBuilder(endpoint)
                .timeout(TIMEOUT)
                .header("Authorization", keys.authorization(endpoint, subject()))
                .header("Content-Encoding", "aes128gcm")
                .header("Content-Type", "application/octet-stream")
                .header("TTL", Long.toString(ttl.toSeconds()))
                .POST(HttpRequest.BodyPublishers.ofByteArray(body));
        if (topic != null) {
            request.header("Topic", topic);
        }
        try {
            int status = client.send(request.build(), HttpResponse.BodyHandlers.discarding()).statusCode();
            return new Result(outcome(status), status);
        } catch (IOException e) {
            log.warn("Push service {} unreachable: {}", endpoint.getHost(), e.getClass().getSimpleName());
            return new Result(Outcome.RETRY, 0);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Result(Outcome.RETRY, 0);
        }
    }

    // shortcut: Retry-After is not read, the delivery queue's own backoff applies; upgrade if a push service throttles us
    private static Outcome outcome(int status) {
        if (status >= 200 && status < 300) {
            return Outcome.SENT;
        }
        if (status == 404 || status == 410) {
            return Outcome.GONE;
        }
        return status == 429 || status >= 500 ? Outcome.RETRY : Outcome.REJECTED;
    }

    private @Nullable String subject() {
        String configured = properties.webpush().subject();
        return configured != null && !configured.isBlank() ? configured : portal.address().orElse(null);
    }
}

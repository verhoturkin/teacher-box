package ru.teacherbox.notifications.webpush;

import java.net.URI;
import java.security.KeyPair;
import java.security.interfaces.ECPublicKey;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.notifications.persistence.VapidKeyRepository;
import ru.teacherbox.notifications.persistence.VapidKeyRepository.StoredKeys;

/**
 * The VAPID key pair of the portal (ADR-0051): made on the first start, kept in the database and in its
 * backups. The private key is write-only: nothing here gives it out, the store signs for the callers.
 */
@Component
public class VapidKeyStore {

    /** RFC 8292 allows a day at most. */
    private static final Duration TOKEN_LIFETIME = Duration.ofHours(12);
    private static final Base64.Encoder BASE64 = Base64.getUrlEncoder().withoutPadding();

    private final VapidKeyRepository repository;
    private final Clock clock;

    VapidKeyStore(VapidKeyRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @EventListener(ApplicationReadyEvent.class)
    void createOnFirstStart() {
        keys();
    }

    /** The public key, base64url of the uncompressed point: what the browser takes as {@code applicationServerKey}. */
    public String publicKey() {
        return keys().publicKey();
    }

    /** The {@code Authorization} header for a message to the push service at {@code endpoint}. */
    public String authorization(URI endpoint, @Nullable String subject) {
        StoredKeys keys = keys();
        String jwt = Vapid.jwt(Vapid.audience(endpoint), subject, clock.instant().plus(TOKEN_LIFETIME),
                WebPushCrypto.privateKey(Base64.getUrlDecoder().decode(keys.privateKey())));
        return Vapid.authorization(jwt, Base64.getUrlDecoder().decode(keys.publicKey()));
    }

    private synchronized StoredKeys keys() {
        return repository.find().orElseGet(() -> {
            KeyPair pair = WebPushCrypto.newKeyPair();
            repository.insertIfAbsent(new StoredKeys(
                    BASE64.encodeToString(WebPushCrypto.uncompressed((ECPublicKey) pair.getPublic())),
                    BASE64.encodeToString(WebPushCrypto.scalar(pair.getPrivate())), clock.instant()));
            return repository.find().orElseThrow();
        });
    }
}

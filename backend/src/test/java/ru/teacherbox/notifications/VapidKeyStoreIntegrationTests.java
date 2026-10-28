package ru.teacherbox.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.teacherbox.notifications.persistence.VapidKeyRepository;
import ru.teacherbox.notifications.webpush.VapidKeyStore;
import ru.teacherbox.testing.MutableClock;

/** The VAPID key pair of the portal: made once, kept, and never given out (ADR-0051). */
@NotificationsIntegrationTest
class VapidKeyStoreIntegrationTests {

    @Autowired
    VapidKeyStore store;

    @Autowired
    VapidKeyRepository repository;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    MutableClock clock;

    @Test
    void theKeyIsAnUncompressedPointThatStaysTheSame() {
        String key = store.publicKey();

        byte[] point = Base64.getUrlDecoder().decode(key);
        assertThat(point).hasSize(65);
        assertThat(point[0]).isEqualTo((byte) 4);
        assertThat(store.publicKey()).isEqualTo(key);
        assertThat(jdbc.sql("select count(*) from notifications.webpush_keys").query(Integer.class).single())
                .isEqualTo(1);
    }

    @Test
    void theHeaderIsSignedByTheStoredKeyForThePushService() {
        String header = store.authorization(URI.create("https://push.example.net:8443/p/abc"), "mailto:push@example.com");

        String[] parts = header.substring("vapid t=".length()).split(", k=");
        assertThat(parts[1]).isEqualTo(store.publicKey());
        String[] jwt = parts[0].split("\\.");
        assertThat(new String(Base64.getUrlDecoder().decode(jwt[1]), StandardCharsets.UTF_8))
                .isEqualTo("{\"aud\":\"https://push.example.net:8443\",\"exp\":" + clock.instant().plusSeconds(12 * 3600)
                        .getEpochSecond() + ",\"sub\":\"mailto:push@example.com\"}");
        assertThat(Base64.getUrlDecoder().decode(jwt[2])).as("ES256 signature: R and S").hasSize(64);
    }

    @Test
    void thePrivateKeyIsNotPrintedAndANewPairAppearsAfterTheRowIsErased() {
        String before = store.publicKey();
        String privateKey = jdbc.sql("select private_key from notifications.webpush_keys")
                .query(String.class).single();

        assertThat(repository.find().orElseThrow().toString()).doesNotContain(privateKey).contains(before);

        jdbc.sql("delete from notifications.webpush_keys").update();

        assertThat(store.publicKey()).isNotEqualTo(before);
    }

    @Test
    void aSecondInsertDoesNotReplaceThePair() {
        VapidKeyRepository.StoredKeys stored = repository.find().orElseGet(() -> {
            store.publicKey();
            return repository.find().orElseThrow();
        });

        assertThat(repository.insertIfAbsent(new VapidKeyRepository.StoredKeys("a", "b", clock.instant()))).isFalse();
        assertThat(repository.find()).contains(stored);
    }
}

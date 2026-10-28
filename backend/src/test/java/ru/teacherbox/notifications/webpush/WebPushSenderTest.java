package ru.teacherbox.notifications.webpush;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.security.interfaces.ECPublicKey;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import ru.teacherbox.notifications.application.NotificationsProperties;
import ru.teacherbox.notifications.webpush.WebPushSender.Outcome;
import ru.teacherbox.shared.portal.Portal;

/** The request to a push service and what its answers mean; a local server stands for the service. */
class WebPushSenderTest {

    private final VapidKeyStore keys = mock(VapidKeyStore.class);
    private final Portal portal = mock(Portal.class);
    private final AtomicInteger status = new AtomicInteger(201);
    private final AtomicReference<com.sun.net.httpserver.Headers> headers = new AtomicReference<>();
    private final AtomicReference<byte[]> body = new AtomicReference<>();
    private HttpServer server;
    private PushTarget target;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.createContext("/push", exchange -> {
            headers.set(exchange.getRequestHeaders());
            body.set(exchange.getRequestBody().readAllBytes());
            exchange.sendResponseHeaders(status.get(), -1);
            exchange.close();
        });
        server.start();
        byte[] device = WebPushCrypto.uncompressed((ECPublicKey) WebPushCrypto.newKeyPair().getPublic());
        target = new PushTarget("http://localhost:" + server.getAddress().getPort() + "/push", device, new byte[16]);
        when(keys.authorization(any(), any())).thenReturn("vapid t=token, k=key");
        when(portal.address()).thenReturn(Optional.empty());
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void postsTheEncryptedMessageWithTheVapidProof() {
        Outcome outcome = sender(null, false).send(target, "hi".getBytes(StandardCharsets.UTF_8),
                Duration.ofHours(1), "lesson-1").outcome();

        assertThat(outcome).isEqualTo(Outcome.SENT);
        assertThat(headers.get().getFirst("Authorization")).isEqualTo("vapid t=token, k=key");
        assertThat(headers.get().getFirst("Content-Encoding")).isEqualTo("aes128gcm");
        assertThat(headers.get().getFirst("Content-type")).isEqualTo("application/octet-stream");
        assertThat(headers.get().getFirst("Ttl")).isEqualTo("3600");
        assertThat(headers.get().getFirst("Topic")).isEqualTo("lesson-1");
        assertThat(body.get()).hasSize(86 + 2 + 1 + 16);
    }

    @Test
    void withoutATopicTheHeaderIsNotSent() {
        sender(null, false).send(target, new byte[1], Duration.ofMinutes(1), null);

        assertThat(headers.get().containsKey("Topic")).isFalse();
    }

    @Test
    void theSubjectIsTheSettingThenThePortalAddressThenNothing() {
        URI endpoint = URI.create(target.endpoint());

        sender("mailto:me@example.com", false).send(target, new byte[1], Duration.ofMinutes(1), null);
        verify(keys).authorization(endpoint, "mailto:me@example.com");

        when(portal.address()).thenReturn(Optional.of("https://school.example.com"));
        sender("  ", false).send(target, new byte[1], Duration.ofMinutes(1), null);
        verify(keys).authorization(endpoint, "https://school.example.com");

        when(portal.address()).thenReturn(Optional.empty());
        sender(null, false).send(target, new byte[1], Duration.ofMinutes(1), null);
        verify(keys).authorization(eq(endpoint), eq(null));
    }

    @Test
    void sortsTheAnswersOfThePushService() {
        WebPushSender sender = sender(null, false);

        assertThat(outcomeOf(sender, 200)).isEqualTo(Outcome.SENT);
        assertThat(outcomeOf(sender, 404)).isEqualTo(Outcome.GONE);
        assertThat(outcomeOf(sender, 410)).isEqualTo(Outcome.GONE);
        assertThat(outcomeOf(sender, 429)).isEqualTo(Outcome.RETRY);
        assertThat(outcomeOf(sender, 503)).isEqualTo(Outcome.RETRY);
        assertThat(outcomeOf(sender, 400)).isEqualTo(Outcome.REJECTED);
        assertThat(outcomeOf(sender, 413)).isEqualTo(Outcome.REJECTED);
        assertThat(sender.send(target, new byte[1], Duration.ofMinutes(1), null).status()).isEqualTo(413);
    }

    @Test
    void noConnectionIsATemporaryFailure() {
        server.stop(0);

        assertThat(sender(null, false).send(target, new byte[1], Duration.ofMinutes(1), null))
                .isEqualTo(new WebPushSender.Result(Outcome.RETRY, 0));
    }

    @Test
    void refusesWhatCannotBeSentWithoutAskingTheServer() {
        WebPushSender secure = sender(null, true);

        assertThat(secure.send(target, new byte[1], Duration.ofMinutes(1), null).outcome())
                .as("plain HTTP is for tests only").isEqualTo(Outcome.REJECTED);
        assertThat(secure.send(new PushTarget("not an address", target.p256dh(), target.auth()), new byte[1],
                Duration.ofMinutes(1), null).outcome()).isEqualTo(Outcome.REJECTED);
        assertThat(sender(null, false).send(new PushTarget(target.endpoint(), new byte[65], target.auth()),
                new byte[1], Duration.ofMinutes(1), null).outcome()).as("a key that is no point").isEqualTo(Outcome.REJECTED);
        assertThat(sender(null, false).send(target, new byte[WebPushCrypto.MAX_PLAINTEXT + 1], Duration.ofMinutes(1),
                null).outcome()).as("too long").isEqualTo(Outcome.REJECTED);
        assertThat(headers.get()).isNull();
    }

    @Test
    void theTargetDoesNotPrintTheAddressOfTheDevice() {
        assertThat(target.toString()).doesNotContain("localhost");
    }

    private Outcome outcomeOf(WebPushSender sender, int answer) {
        status.set(answer);
        return sender.send(target, new byte[1], Duration.ofMinutes(1), null).outcome();
    }

    private WebPushSender sender(String subject, boolean httpsOnly) {
        return new WebPushSender(keys, portal, new NotificationsProperties(8, Duration.ofMinutes(15), null, null, null,
                new NotificationsProperties.WebPush(subject)), HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build(), httpsOnly);
    }
}

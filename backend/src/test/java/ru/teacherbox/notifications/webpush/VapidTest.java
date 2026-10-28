package ru.teacherbox.notifications.webpush;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PublicKey;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.time.Instant;
import java.util.Base64;
import org.junit.jupiter.api.Test;

/** The VAPID token of RFC 8292; the example is the one of its Section 2.4. */
class VapidTest {

    private static final String RFC_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9."
            + "eyJhdWQiOiJodHRwczovL3B1c2guZXhhbXBsZS5uZXQiLCJleHAiOjE0NTM1MjM3NjgsInN1YiI6Im1haWx0bzpwdXNoQGV4"
            + "YW1wbGUuY29tIn0.i3CYb7t4xfxCDquptFOepC9GAu_HLGkMlMuCGSK2rpiUfnK9ojFwDXb1JrErtmysazNjjvW2L9OkSSHzvoD1oA";
    private static final byte[] RFC_KEY = Base64.getUrlDecoder().decode(
            "BA1Hxzyi1RUM1b5wjxsn7nGxAszw2u61m164i3MrAIxHF6YK5h4SDYic-dRuU_RCPCfA5aq9ojSwk5Y2EmClBPs");

    @Test
    void buildsTheSignedPartOfTheRfcExampleAndItsSignatureChecks() throws Exception {
        KeyPair pair = newKeyPair();

        String token = Vapid.jwt("https://push.example.net", "mailto:push@example.com",
                Instant.ofEpochSecond(1453523768), pair.getPrivate());

        assertThat(token).startsWith(RFC_TOKEN.substring(0, RFC_TOKEN.lastIndexOf('.') + 1));
        assertThat(verifies(token, pair.getPublic())).isTrue();
        assertThat(verifies(RFC_TOKEN, WebPushCrypto.publicKey(RFC_KEY))).as("the signature of the RFC").isTrue();
        assertThat(verifies(RFC_TOKEN, pair.getPublic())).isFalse();
    }

    @Test
    void leavesOutTheSubjectWhenThereIsNone() throws Exception {
        String token = Vapid.jwt("https://push.example.net", null, Instant.ofEpochSecond(1), newKeyPair().getPrivate());

        assertThat(new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]), StandardCharsets.UTF_8))
                .isEqualTo("{\"aud\":\"https://push.example.net\",\"exp\":1}");
    }

    @Test
    void theHeaderCarriesTheTokenAndThePublicKey() throws Exception {
        KeyPair pair = newKeyPair();
        byte[] key = WebPushCrypto.uncompressed((ECPublicKey) pair.getPublic());

        assertThat(Vapid.authorization("a.b.c", key))
                .isEqualTo("vapid t=a.b.c, k=" + Base64.getUrlEncoder().withoutPadding().encodeToString(key));
    }

    @Test
    void theAudienceIsTheOriginOfThePushService() {
        assertThat(Vapid.audience(URI.create("https://fcm.googleapis.com/fcm/send/abc"))).isEqualTo("https://fcm.googleapis.com");
        assertThat(Vapid.audience(URI.create("https://push.example.net:8443/p/1?x=2"))).isEqualTo("https://push.example.net:8443");
    }

    private static KeyPair newKeyPair() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        return generator.generateKeyPair();
    }

    private static boolean verifies(String token, PublicKey key) throws Exception {
        int dot = token.lastIndexOf('.');
        Signature signature = Signature.getInstance("SHA256withECDSAinP1363Format");
        signature.initVerify(key);
        signature.update(token.substring(0, dot).getBytes(StandardCharsets.US_ASCII));
        return signature.verify(Base64.getUrlDecoder().decode(token.substring(dot + 1)));
    }
}

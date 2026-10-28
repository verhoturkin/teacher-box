package ru.teacherbox.notifications.webpush;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.interfaces.ECPublicKey;
import java.util.Arrays;
import java.util.Base64;
import org.junit.jupiter.api.Test;

/** Payload encryption of RFC 8291; the vectors are those of its Section 5 and Appendix A. */
class WebPushCryptoTest {

    private static final byte[] AS_PRIVATE = decode("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw");
    private static final byte[] AS_PUBLIC = decode(
            "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
    private static final byte[] UA_PRIVATE = decode("q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94");
    private static final byte[] UA_PUBLIC = decode(
            "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
    private static final byte[] AUTH_SECRET = decode("BTBZMqHH6r4Tts7J_aSIgg");
    private static final byte[] SALT = decode("DGv6ra1nlYgDCS1FRnbzlw");
    private static final byte[] PLAINTEXT = decode("V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24");
    private static final byte[] HEADER = decode("DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml"
            + "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
    private static final byte[] CIPHERTEXT = decode("8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHs"
            + "UoEsbI_0LpXMuGvnzQ");

    @Test
    void producesTheMessageOfTheRfcExample() {
        byte[] body = WebPushCrypto.encrypt(PLAINTEXT, UA_PUBLIC, AUTH_SECRET, SALT,
                WebPushCrypto.privateKey(AS_PRIVATE), AS_PUBLIC);

        assertThat(body).hasSize(HEADER.length + CIPHERTEXT.length);
        assertThat(body).startsWith(HEADER).endsWith(CIPHERTEXT);
        assertThat(new String(PLAINTEXT, StandardCharsets.UTF_8)).isEqualTo("When I grow up, I want to be a watermelon");
    }

    @Test
    void bothSidesDeriveTheSharedSecretOfTheRfc() {
        byte[] expected = decode("kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs");

        assertThat(WebPushCrypto.sharedSecret(WebPushCrypto.privateKey(AS_PRIVATE), WebPushCrypto.publicKey(UA_PUBLIC)))
                .isEqualTo(expected);
        assertThat(WebPushCrypto.sharedSecret(WebPushCrypto.privateKey(UA_PRIVATE), WebPushCrypto.publicKey(AS_PUBLIC)))
                .isEqualTo(expected);
    }

    @Test
    void encodesAPublicKeyAsAnUncompressedPoint() {
        ECPublicKey key = (ECPublicKey) WebPushCrypto.publicKey(UA_PUBLIC);

        assertThat(WebPushCrypto.uncompressed(key)).isEqualTo(UA_PUBLIC);
    }

    @Test
    void aFreshMessageHasTheHeaderOfRfc8188AndAnEphemeralKey() {
        byte[] plaintext = "hello".getBytes(StandardCharsets.UTF_8);

        byte[] first = WebPushCrypto.encrypt(plaintext, UA_PUBLIC, AUTH_SECRET);
        byte[] second = WebPushCrypto.encrypt(plaintext, UA_PUBLIC, AUTH_SECRET);

        // salt 16 + record size 4 + key length 1 + key 65, then the text, the delimiter and the tag
        assertThat(first).hasSize(86 + plaintext.length + 1 + 16);
        assertThat(ByteBuffer.wrap(first, 16, 4).getInt()).isEqualTo(4096);
        assertThat(first[20]).isEqualTo((byte) 65);
        assertThat(WebPushCrypto.publicKey(Arrays.copyOfRange(first, 21, 86))).isNotNull();
        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void acceptsAPayloadUpToTheLimitOnly() {
        assertThat(WebPushCrypto.encrypt(new byte[WebPushCrypto.MAX_PLAINTEXT], UA_PUBLIC, AUTH_SECRET))
                .hasSize(4096);
        assertThatThrownBy(() -> WebPushCrypto.encrypt(new byte[WebPushCrypto.MAX_PLAINTEXT + 1], UA_PUBLIC,
                AUTH_SECRET)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsADeviceKeyThatIsNotAPointOfTheCurve() {
        byte[] offCurve = UA_PUBLIC.clone();
        offCurve[64] ^= 1;
        byte[] compressed = Arrays.copyOf(UA_PUBLIC, 33);
        byte[] wrongPrefix = UA_PUBLIC.clone();
        wrongPrefix[0] = 2;

        for (byte[] key : new byte[][] {offCurve, compressed, wrongPrefix}) {
            assertThatThrownBy(() -> WebPushCrypto.encrypt(PLAINTEXT, key, AUTH_SECRET))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    private static byte[] decode(String base64Url) {
        return Base64.getUrlDecoder().decode(base64Url);
    }
}

package ru.teacherbox.notifications.webpush;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.PrivateKey;
import java.security.Signature;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import tools.jackson.databind.json.JsonMapper;

/** The VAPID proof of the application server (RFC 8292): an ES256 token and the key that signed it. */
final class Vapid {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Base64.Encoder BASE64 = Base64.getUrlEncoder().withoutPadding();

    private Vapid() {
    }

    /** The push service the message goes to: scheme, host and port of its address. */
    static String audience(URI endpoint) {
        return endpoint.getScheme() + "://" + endpoint.getHost() + (endpoint.getPort() < 0 ? "" : ":" + endpoint.getPort());
    }

    /** The compact token; {@code subject} is a {@code mailto:} or an {@code https:} address, left out when absent. */
    static String jwt(String audience, @Nullable String subject, Instant expires, PrivateKey key) {
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("aud", audience);
        claims.put("exp", expires.getEpochSecond());
        if (subject != null) {
            claims.put("sub", subject);
        }
        String signed = part("{\"typ\":\"JWT\",\"alg\":\"ES256\"}") + "." + part(JSON.writeValueAsString(claims));
        try {
            Signature signature = Signature.getInstance("SHA256withECDSAinP1363Format");
            signature.initSign(key);
            signature.update(signed.getBytes(StandardCharsets.US_ASCII));
            return signed + "." + BASE64.encodeToString(signature.sign());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** The value of the {@code Authorization} header. */
    static String authorization(String jwt, byte[] publicKey) {
        return "vapid t=" + jwt + ", k=" + BASE64.encodeToString(publicKey);
    }

    private static String part(String json) {
        return BASE64.encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }
}

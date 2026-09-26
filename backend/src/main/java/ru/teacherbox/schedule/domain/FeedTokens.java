package ru.teacherbox.schedule.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.regex.Pattern;

/**
 * Secret tokens of calendar feed links. The link is shown once; only a hash is stored, like the
 * other one-time secrets of the portal.
 */
public final class FeedTokens {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern FORMAT = Pattern.compile("[A-Za-z0-9_-]{43}");

    private FeedTokens() {
    }

    /** 256 random bits, URL-safe. */
    public static String generate() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** Whether the text may be a token (checked before hashing untrusted input). */
    public static boolean isWellFormed(String token) {
        return FORMAT.matcher(token).matches();
    }

    public static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}

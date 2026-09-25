package ru.teacherbox.notifications.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * One-time codes that bind a messenger account. Codes are short (easy to type into a chat), use an
 * alphabet without look-alike characters and are compared case-insensitively.
 */
public final class LinkCodes {

    public static final int LENGTH = 8;
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();
    /** A separate word in a message, optionally split in halves: "ABCD2345", "abcd-2345", "ABCD 2345". */
    private static final Pattern CODE =
            Pattern.compile("(?i)(?<![A-Z0-9])([A-Z2-9]{4})[\\s-]?([A-Z2-9]{4})(?![A-Z0-9])");

    private LinkCodes() {
    }

    public static String generate() {
        StringBuilder code = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            code.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return code.toString();
    }

    /** "ABCD2345" → "ABCD-2345" for display. */
    public static String display(String code) {
        return code.substring(0, LENGTH / 2) + "-" + code.substring(LENGTH / 2);
    }

    /** Extracts a code from a chat message such as "/start ABCD2345" or "код abcd-2345". */
    public static Optional<String> find(String message) {
        Matcher matcher = CODE.matcher(message);
        return matcher.find()
                ? Optional.of((matcher.group(1) + matcher.group(2)).toUpperCase(Locale.ROOT))
                : Optional.empty();
    }

    public static String hash(String code) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(code.toUpperCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}

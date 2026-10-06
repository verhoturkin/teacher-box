package ru.teacherbox.identity.domain;

import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.Optional;

/**
 * A student's photo: the key of the file in the module's storage and its type.
 *
 * @param key         storage key; also the secret part of the photo's address
 * @param contentType {@code image/png}, {@code image/jpeg} or {@code image/webp}
 */
public record Avatar(String key, String contentType) {

    /** The largest photo, bytes (the browser scales it down before sending). */
    public static final int MAX_SIZE = 1024 * 1024;

    public Avatar {
        Objects.requireNonNull(key);
        Objects.requireNonNull(contentType);
    }

    /** What kind of image the content is, by its first bytes; SVG is not accepted (it can carry scripts). */
    public static Optional<String> detectType(byte[] content) {
        if (startsWith(content, 0x89, 'P', 'N', 'G')) {
            return Optional.of("image/png");
        }
        if (startsWith(content, 0xFF, 0xD8, 0xFF)) {
            return Optional.of("image/jpeg");
        }
        if (content.length >= 12 && startsWith(content, 'R', 'I', 'F', 'F')
                && new String(content, 8, 4, StandardCharsets.US_ASCII).equals("WEBP")) {
            return Optional.of("image/webp");
        }
        return Optional.empty();
    }

    private static boolean startsWith(byte[] content, int... prefix) {
        if (content.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if ((content[i] & 0xFF) != prefix[i]) {
                return false;
            }
        }
        return true;
    }
}

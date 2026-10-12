package ru.teacherbox.billing.domain;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * A receipt of a payment: a picture or a PDF the teacher attached. The type is recognized by the first
 * bytes of the file, never taken from the client or the messenger.
 *
 * @param key         storage key in the namespace {@value #NAMESPACE}
 * @param filename    name to download it with; its extension matches the type
 * @param contentType one of the allowed types
 * @param size        bytes
 */
public record Receipt(String key, String filename, String contentType, long size) {

    public static final String NAMESPACE = "billing";
    public static final long MAX_SIZE = 10L * 1024 * 1024;
    /** Bytes enough to recognize every allowed type. */
    public static final int HEAD_SIZE = 16;
    static final int MAX_FILENAME = 255;
    /** An extension has a letter: «Чек от 01.10» has none. */
    private static final Pattern EXTENSION = Pattern.compile("\\.(?=[0-9]*[A-Za-z])[A-Za-z0-9]{1,5}$");

    public Receipt {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(filename, "filename");
        Objects.requireNonNull(contentType, "contentType");
    }

    /** The receipt of a stored file whose first bytes and size are known. */
    public static Receipt of(String key, String originalName, byte[] head, long size) {
        if (size <= 0) {
            throw new BusinessRuleException("receipt.empty", "The receipt file is empty");
        }
        if (size > MAX_SIZE) {
            throw new BusinessRuleException("receipt.too-large", "A receipt must not exceed 10 MB");
        }
        String contentType = typeOf(head).orElseThrow(() -> new BusinessRuleException("receipt.type-not-allowed",
                "A receipt must be a JPEG, PNG, WebP or HEIC picture or a PDF"));
        return new Receipt(key, filename(originalName, contentType), contentType, size);
    }

    /** JPEG, PNG, WebP, HEIC or PDF by the first bytes. */
    static Optional<String> typeOf(byte[] head) {
        if (startsWith(head, 0, 0xFF, 0xD8, 0xFF)) {
            return Optional.of("image/jpeg");
        }
        if (startsWith(head, 0, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)) {
            return Optional.of("image/png");
        }
        if (startsWith(head, 0, 'R', 'I', 'F', 'F') && startsWith(head, 8, 'W', 'E', 'B', 'P')) {
            return Optional.of("image/webp");
        }
        if (startsWith(head, 4, 'f', 't', 'y', 'p') && head.length >= 12) {
            String brand = new String(Arrays.copyOfRange(head, 8, 12), StandardCharsets.US_ASCII);
            if (brand.startsWith("hei") || brand.startsWith("hev") || brand.equals("mif1") || brand.equals("msf1")) {
                return Optional.of("image/heic");
            }
        }
        if (startsWith(head, 0, '%', 'P', 'D', 'F', '-')) {
            return Optional.of("application/pdf");
        }
        return Optional.empty();
    }

    /** The name without path parts and control characters, with the extension of the type. */
    static String filename(String original, String contentType) {
        String extension = switch (contentType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/heic" -> ".heic";
            default -> ".pdf";
        };
        String name = original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("\\p{Cntrl}", "").strip();
        Matcher matcher = EXTENSION.matcher(name);
        String base = matcher.find() ? name.substring(0, matcher.start()) : name;
        String current = name.substring(base.length()).toLowerCase(Locale.ROOT);
        boolean fits = current.equals(extension) || (extension.equals(".jpg") && current.equals(".jpeg"));
        if (fits) {
            extension = current;
        }
        if (base.isBlank() || base.equals(".")) {
            base = "receipt";
        }
        if (base.length() + extension.length() > MAX_FILENAME) {
            base = base.substring(0, MAX_FILENAME - extension.length());
        }
        return base + extension;
    }

    private static boolean startsWith(byte[] bytes, int offset, int... expected) {
        if (bytes.length < offset + expected.length) {
            return false;
        }
        for (int i = 0; i < expected.length; i++) {
            if ((bytes[offset + i] & 0xFF) != expected[i]) {
                return false;
            }
        }
        return true;
    }
}

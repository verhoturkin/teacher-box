package ru.teacherbox.boards.domain;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * Which images a board takes: png, jpeg, webp and gif — never SVG (it can carry scripts). The type is
 * checked against the first bytes of the file, not only the client's word.
 */
public final class BoardImages {

    /** Like an attachment of a homework. */
    public static final long MAX_SIZE = 20L * 1024 * 1024;

    private static final Pattern FILE_ID = Pattern.compile("[A-Za-z0-9_-]{1," + SceneElements.MAX_ID + "}");

    private BoardImages() {
    }

    public static String validFileId(String fileId) {
        if (!FILE_ID.matcher(fileId).matches()) {
            throw new BusinessRuleException("boards.file-id-invalid", "Invalid file id");
        }
        return fileId;
    }

    /**
     * @param declared the content type the client sent
     * @param head     the first bytes of the file (at least 12 when the file is that long)
     * @return the content type to store and to serve
     */
    public static String contentType(@Nullable String declared, byte[] head) {
        String type = declared == null ? "" : declared.split(";")[0].strip().toLowerCase(Locale.ROOT);
        boolean matches = switch (type) {
            case "image/png" -> startsWith(head, 0, new byte[] {(byte) 0x89, 'P', 'N', 'G'});
            case "image/jpeg" -> startsWith(head, 0, new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF});
            case "image/gif" -> startsWith(head, 0, "GIF8".getBytes(StandardCharsets.US_ASCII));
            case "image/webp" -> startsWith(head, 0, "RIFF".getBytes(StandardCharsets.US_ASCII))
                    && startsWith(head, 8, "WEBP".getBytes(StandardCharsets.US_ASCII));
            default -> false;
        };
        if (!matches) {
            throw new BusinessRuleException("boards.file-type-not-allowed", "Only png, jpeg, webp and gif images");
        }
        return type;
    }

    public static void checkSize(long size) {
        if (size > MAX_SIZE) {
            throw new BusinessRuleException("boards.file-too-large",
                    "The image is larger than " + MAX_SIZE / 1024 / 1024 + " MB");
        }
    }

    private static boolean startsWith(byte[] head, int offset, byte[] magic) {
        return head.length >= offset + magic.length
                && Arrays.equals(head, offset, offset + magic.length, magic, 0, magic.length);
    }
}

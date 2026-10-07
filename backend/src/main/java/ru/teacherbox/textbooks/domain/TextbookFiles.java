package ru.teacherbox.textbooks.domain;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.textbooks.api.TextbookFormat;

/**
 * Which files a textbook takes: png, jpeg, webp, gif, PDF, DOC and DOCX — never SVG (it can carry scripts).
 * The type is found by the first bytes of the file; a Word file must also have its extension.
 */
public final class TextbookFiles {

    /** The largest file. */
    public static final long MAX_SIZE = 100L * 1024 * 1024;
    /** Bytes {@link #typeOf} looks at. */
    public static final int HEAD = 16;
    public static final int MAX_FILENAME = 255;

    /** A recognised file. */
    public record FileType(String contentType, TextbookFormat format) {
    }

    private static final FileType PNG = new FileType("image/png", TextbookFormat.IMAGE);
    private static final FileType JPEG = new FileType("image/jpeg", TextbookFormat.IMAGE);
    private static final FileType GIF = new FileType("image/gif", TextbookFormat.IMAGE);
    private static final FileType WEBP = new FileType("image/webp", TextbookFormat.IMAGE);
    private static final FileType PDF = new FileType("application/pdf", TextbookFormat.PDF);
    private static final FileType DOC = new FileType("application/msword", TextbookFormat.DOCUMENT);
    private static final FileType DOCX = new FileType(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", TextbookFormat.DOCUMENT);

    private static final byte[] PNG_MAGIC = {(byte) 0x89, 'P', 'N', 'G'};
    private static final byte[] JPEG_MAGIC = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] OLE_MAGIC = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, (byte) 0xA1, (byte) 0xB1,
            0x1A, (byte) 0xE1};
    private static final byte[] ZIP_MAGIC = {'P', 'K', 3, 4};

    private TextbookFiles() {
    }

    /**
     * @param filename the cleaned name of the file
     * @param head     the first {@link #HEAD} bytes of the file (fewer when it is shorter)
     * @throws BusinessRuleException {@code textbooks.file-type-not-allowed} for any other file
     */
    public static FileType typeOf(String filename, byte[] head) {
        String extension = extension(filename);
        if (startsWith(head, 0, PNG_MAGIC)) {
            return PNG;
        }
        if (startsWith(head, 0, JPEG_MAGIC)) {
            return JPEG;
        }
        if (startsWith(head, 0, ascii("GIF8"))) {
            return GIF;
        }
        if (startsWith(head, 0, ascii("RIFF")) && startsWith(head, 8, ascii("WEBP"))) {
            return WEBP;
        }
        if (startsWith(head, 0, ascii("%PDF-"))) {
            return PDF;
        }
        if (extension.equals("doc") && startsWith(head, 0, OLE_MAGIC)) {
            return DOC;
        }
        if (extension.equals("docx") && startsWith(head, 0, ZIP_MAGIC)) {
            return DOCX;
        }
        throw new BusinessRuleException("textbooks.file-type-not-allowed",
                "Only images (png, jpeg, webp, gif), PDF, DOC and DOCX");
    }

    /** @throws BusinessRuleException for an empty file or one over {@link #MAX_SIZE} */
    public static void checkSize(long size) {
        if (size > MAX_SIZE) {
            throw new BusinessRuleException("textbooks.file-too-large",
                    "The file is larger than " + MAX_SIZE / 1024 / 1024 + " MB");
        }
        if (size <= 0) {
            throw new BusinessRuleException("textbooks.file-empty", "The file is empty");
        }
    }

    /** File name without path parts and control characters, at most {@link #MAX_FILENAME} characters. */
    public static String cleanFilename(@Nullable String original) {
        String name = original == null ? "" : original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("\\p{Cntrl}", "").strip();
        if (name.isEmpty() || name.equals(".") || name.equals("..")) {
            return "file";
        }
        if (name.length() > MAX_FILENAME) {
            int dot = name.lastIndexOf('.');
            String extension = dot < 0 || name.length() - dot > 10 ? "" : name.substring(dot);
            name = name.substring(0, MAX_FILENAME - extension.length()) + extension;
        }
        return name;
    }

    private static String extension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static byte[] ascii(String text) {
        return text.getBytes(StandardCharsets.US_ASCII);
    }

    private static boolean startsWith(byte[] head, int offset, byte[] magic) {
        return head.length >= offset + magic.length
                && Arrays.equals(head, offset, offset + magic.length, magic, 0, magic.length);
    }
}

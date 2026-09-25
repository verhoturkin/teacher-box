package ru.teacherbox.homework.domain;

import java.util.Locale;
import java.util.Map;
import ru.teacherbox.shared.error.BusinessRuleException;

/**
 * Which files may be attached: documents, images, audio, archives. The content type served on
 * download is taken from this list by extension, never from the uploading client.
 */
public final class FilePolicy {

    public static final int MAX_FILENAME = 255;

    private static final Map<String, String> CONTENT_TYPES = Map.ofEntries(
            Map.entry("pdf", "application/pdf"),
            Map.entry("txt", "text/plain"),
            Map.entry("md", "text/markdown"),
            Map.entry("rtf", "application/rtf"),
            Map.entry("doc", "application/msword"),
            Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            Map.entry("xls", "application/vnd.ms-excel"),
            Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            Map.entry("ppt", "application/vnd.ms-powerpoint"),
            Map.entry("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
            Map.entry("odt", "application/vnd.oasis.opendocument.text"),
            Map.entry("ods", "application/vnd.oasis.opendocument.spreadsheet"),
            Map.entry("odp", "application/vnd.oasis.opendocument.presentation"),
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"),
            Map.entry("png", "image/png"),
            Map.entry("gif", "image/gif"),
            Map.entry("webp", "image/webp"),
            Map.entry("heic", "image/heic"),
            Map.entry("mp3", "audio/mpeg"),
            Map.entry("m4a", "audio/mp4"),
            Map.entry("ogg", "audio/ogg"),
            Map.entry("wav", "audio/wav"),
            Map.entry("zip", "application/zip"));

    private FilePolicy() {
    }

    /** Content type for an allowed file name; rejects other types. */
    public static String contentTypeOf(String filename) {
        int dot = filename.lastIndexOf('.');
        String extension = dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
        String contentType = CONTENT_TYPES.get(extension);
        if (contentType == null) {
            throw new BusinessRuleException("file.type-not-allowed",
                    "This file type is not allowed: " + (extension.isEmpty() ? "no extension" : extension));
        }
        return contentType;
    }

    /** File name without path parts and control characters, at most {@link #MAX_FILENAME} characters. */
    public static String cleanFilename(String original) {
        String name = original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("\\p{Cntrl}", "").strip();
        if (name.isEmpty() || name.equals(".") || name.equals("..")) {
            throw new BusinessRuleException("file.name-invalid", "Invalid file name");
        }
        if (name.length() > MAX_FILENAME) {
            int dot = name.lastIndexOf('.');
            String extension = dot < 0 ? "" : name.substring(dot);
            name = name.substring(0, MAX_FILENAME - extension.length()) + extension;
        }
        return name;
    }
}

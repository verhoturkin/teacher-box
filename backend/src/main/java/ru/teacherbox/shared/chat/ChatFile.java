package ru.teacherbox.shared.chat;

import java.util.Objects;

/**
 * A picture or a document the user sent to the bot (ADR-0038). Its type is not trusted: an action that keeps
 * the file recognizes it by the content.
 *
 * @param name    the file's name in the messenger, or a made-up one for a photo (e.g. {@code photo.jpg})
 * @param content at most {@value #MAX_SIZE} bytes
 * @param caption text sent with the file, stripped; empty if none
 */
public record ChatFile(String name, byte[] content, String caption) {

    /** Telegram bots download files up to 20 MB. */
    public static final long MAX_SIZE = 20L * 1024 * 1024;

    public ChatFile {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(content, "content");
        caption = Objects.requireNonNull(caption, "caption").strip();
    }
}

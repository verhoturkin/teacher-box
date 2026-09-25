package ru.teacherbox.homework.application;

import org.springframework.core.io.InputStreamSource;

/**
 * A file received from a client.
 *
 * @param filename original file name as sent by the client (cleaned before storing)
 * @param size     size in bytes as reported by the upload
 */
public record UploadedFile(String filename, long size, InputStreamSource content) {
}

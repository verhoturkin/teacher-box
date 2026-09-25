package ru.teacherbox.shared.files;

/**
 * Result of storing a file.
 *
 * @param key    storage key to load the file later
 * @param size   size in bytes
 * @param sha256 hex-encoded SHA-256 of the content
 */
public record StoredFile(String key, long size, String sha256) {
}

package ru.teacherbox.platform.storage;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.DigestOutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.files.FileStorage;
import ru.teacherbox.shared.files.StoredFile;

/**
 * Stores files on the local file system: {@code <root>/<namespace>/<key>}.
 * Namespaces and keys are strictly validated, which rules out path traversal.
 */
public final class LocalFileStorage implements FileStorage {

    private static final Pattern NAMESPACE = Pattern.compile("[a-z][a-z0-9-]{0,62}");
    private static final Pattern KEY = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");

    private final Path root;

    public LocalFileStorage(Path root) {
        this.root = root.toAbsolutePath().normalize();
    }

    @Override
    public StoredFile store(String namespace, InputStream content) {
        Path directory = namespaceDirectory(namespace);
        Path temp = null;
        try {
            Files.createDirectories(directory);
            temp = Files.createTempFile(directory, "upload-", ".tmp");
            MessageDigest digest = sha256();
            long size;
            try (OutputStream out = new DigestOutputStream(Files.newOutputStream(temp), digest)) {
                size = content.transferTo(out);
            }
            String key = Ids.newId().toString();
            Files.move(temp, directory.resolve(key), StandardCopyOption.ATOMIC_MOVE);
            return new StoredFile(key, size, HexFormat.of().formatHex(digest.digest()));
        } catch (IOException e) {
            deleteQuietly(temp);
            throw new UncheckedIOException("Failed to store file in namespace " + namespace, e);
        }
    }

    @Override
    public Resource load(String namespace, String key) {
        Path file = file(namespace, key);
        if (!Files.isRegularFile(file)) {
            throw new NotFoundException("file.not-found", "File not found");
        }
        return new FileSystemResource(file);
    }

    @Override
    public void delete(String namespace, String key) {
        try {
            Files.deleteIfExists(file(namespace, key));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to delete file " + key, e);
        }
    }

    private Path file(String namespace, String key) {
        if (!KEY.matcher(key).matches()) {
            throw new IllegalArgumentException("Invalid file key");
        }
        return namespaceDirectory(namespace).resolve(key);
    }

    private Path namespaceDirectory(String namespace) {
        if (!NAMESPACE.matcher(namespace).matches()) {
            throw new IllegalArgumentException("Invalid storage namespace: " + namespace);
        }
        return root.resolve(namespace);
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    private static void deleteQuietly(@Nullable Path temp) {
        if (temp == null) {
            return;
        }
        try {
            Files.deleteIfExists(temp);
        } catch (IOException ignored) {
            // best effort cleanup of a temporary file
        }
    }
}

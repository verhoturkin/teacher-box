package ru.teacherbox.platform.security;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.jspecify.annotations.Nullable;

/**
 * Resolves the HMAC key used to sign access tokens.
 *
 * <ol>
 *   <li>explicit secret ({@code TEACHERBOX_SECURITY_JWT_SECRET}), at least 32 bytes;</li>
 *   <li>otherwise a key file in the data directory;</li>
 *   <li>otherwise a new random key is generated and saved to the key file.</li>
 * </ol>
 */
final class JwtSecretResolver {

    static final int MIN_KEY_BYTES = 32;
    private static final String ALGORITHM = "HmacSHA256";

    private JwtSecretResolver() {
    }

    static SecretKey resolve(@Nullable String configuredSecret, Path keyFile) {
        if (configuredSecret != null && !configuredSecret.isBlank()) {
            byte[] bytes = configuredSecret.getBytes(StandardCharsets.UTF_8);
            if (bytes.length < MIN_KEY_BYTES) {
                throw new IllegalStateException(
                        "JWT secret must be at least " + MIN_KEY_BYTES + " bytes long");
            }
            return new SecretKeySpec(bytes, ALGORITHM);
        }
        try {
            if (Files.isRegularFile(keyFile)) {
                byte[] bytes = Base64.getDecoder().decode(Files.readString(keyFile).trim());
                return new SecretKeySpec(bytes, ALGORITHM);
            }
            byte[] bytes = new byte[MIN_KEY_BYTES];
            new SecureRandom().nextBytes(bytes);
            Files.createDirectories(keyFile.toAbsolutePath().getParent());
            Files.writeString(keyFile, Base64.getEncoder().encodeToString(bytes));
            restrictPermissions(keyFile);
            return new SecretKeySpec(bytes, ALGORITHM);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read or create JWT key file " + keyFile, e);
        }
    }

    private static void restrictPermissions(Path keyFile) throws IOException {
        if (Files.getFileAttributeView(keyFile, java.nio.file.attribute.PosixFileAttributeView.class) != null) {
            Files.setPosixFilePermissions(keyFile, PosixFilePermissions.fromString("rw-------"));
        }
    }
}

package ru.teacherbox.platform.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class JwtSecretResolverTest {

    @TempDir
    Path dir;

    @Test
    void usesConfiguredSecret() {
        String secret = "0123456789abcdef0123456789abcdef";

        SecretKey key = JwtSecretResolver.resolve(secret, dir.resolve("keys/jwt.key"));

        assertThat(key.getEncoded()).isEqualTo(secret.getBytes(StandardCharsets.UTF_8));
        assertThat(key.getAlgorithm()).isEqualTo("HmacSHA256");
        assertThat(dir.resolve("keys/jwt.key")).doesNotExist();
    }

    @Test
    void rejectsShortConfiguredSecret() {
        assertThatThrownBy(() -> JwtSecretResolver.resolve("short", dir.resolve("jwt.key")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32");
    }

    @Test
    void generatesAndPersistsKeyWhenNotConfigured() {
        Path keyFile = dir.resolve("keys/jwt.key");

        SecretKey first = JwtSecretResolver.resolve(null, keyFile);
        SecretKey second = JwtSecretResolver.resolve("  ", keyFile);

        assertThat(keyFile).exists();
        assertThat(first.getEncoded()).hasSize(JwtSecretResolver.MIN_KEY_BYTES);
        assertThat(second.getEncoded()).isEqualTo(first.getEncoded());
    }

    @Test
    void failsWhenKeyFileCannotBeCreated() throws IOException {
        Path blocker = Files.writeString(dir.resolve("blocker"), "file, not a directory");

        assertThatThrownBy(() -> JwtSecretResolver.resolve(null, blocker.resolve("jwt.key")))
                .isInstanceOf(UncheckedIOException.class);
    }
}

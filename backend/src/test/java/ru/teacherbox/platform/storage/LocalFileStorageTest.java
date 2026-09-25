package ru.teacherbox.platform.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.Resource;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.files.StoredFile;

class LocalFileStorageTest {

    @TempDir
    Path root;

    @Test
    void storesLoadsAndDeletesFiles() throws IOException {
        LocalFileStorage storage = new LocalFileStorage(root);

        StoredFile stored = storage.store("homework", stream("hello"));

        assertThat(stored.size()).isEqualTo(5);
        assertThat(stored.sha256()).isEqualTo("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
        Resource resource = storage.load("homework", stored.key());
        assertThat(resource.getContentAsString(StandardCharsets.UTF_8)).isEqualTo("hello");
        assertThat(root.resolve("homework").resolve(stored.key())).exists();

        storage.delete("homework", stored.key());

        assertThatThrownBy(() -> storage.load("homework", stored.key())).isInstanceOf(NotFoundException.class);
    }

    @Test
    void leavesNoTemporaryFiles() throws IOException {
        LocalFileStorage storage = new LocalFileStorage(root);

        storage.store("ai", stream("data"));

        try (Stream<Path> files = Files.list(root.resolve("ai"))) {
            assertThat(files.map(p -> p.getFileName().toString())).noneMatch(name -> name.endsWith(".tmp"));
        }
    }

    @Test
    void deletingMissingFileIsNoOp() {
        LocalFileStorage storage = new LocalFileStorage(root);

        assertThatCode(() -> storage.delete("homework", UUID.randomUUID().toString())).doesNotThrowAnyException();
    }

    @Test
    void rejectsPathTraversal() {
        LocalFileStorage storage = new LocalFileStorage(root);

        assertThatThrownBy(() -> storage.load("homework", "../../etc/passwd"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> storage.load("../secret", UUID.randomUUID().toString()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> storage.store("Upper", stream("x")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void failedWriteLeavesNoPartialFile() throws IOException {
        LocalFileStorage storage = new LocalFileStorage(root);
        InputStream failing = new InputStream() {
            @Override
            public int read() throws IOException {
                throw new IOException("boom");
            }
        };

        assertThatThrownBy(() -> storage.store("homework", failing)).isInstanceOf(UncheckedIOException.class);

        try (Stream<Path> files = Files.list(root.resolve("homework"))) {
            assertThat(files).isEmpty();
        }
    }

    @Test
    void failsWhenRootIsNotADirectory() throws IOException {
        Path file = Files.writeString(root.resolve("file"), "x");
        LocalFileStorage storage = new LocalFileStorage(file);

        assertThatThrownBy(() -> storage.store("homework", stream("x"))).isInstanceOf(UncheckedIOException.class);
    }

    @Test
    void failsToDeleteNonEmptyDirectoryWithFileKey() throws IOException {
        LocalFileStorage storage = new LocalFileStorage(root);
        String key = UUID.randomUUID().toString();
        Path directory = Files.createDirectories(root.resolve("homework").resolve(key));
        Files.writeString(directory.resolve("inner"), "x");

        assertThatThrownBy(() -> storage.delete("homework", key)).isInstanceOf(UncheckedIOException.class);
    }

    private static InputStream stream(String content) {
        return new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8));
    }
}

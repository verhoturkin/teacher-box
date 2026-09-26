package ru.teacherbox.platform.admin;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import java.util.zip.GZIPInputStream;
import org.jspecify.annotations.Nullable;

/**
 * Files of the JSON log ({@code logging.file.name}): the current file and the rotated ones next to it
 * ({@code teacher-box.log.2026-09-26.0.gz}).
 *
 * @param current the current log file, or {@code null} when file logging is off
 */
public record LogFiles(@Nullable Path current) {

    /** All log files, oldest first; empty when file logging is off or nothing was written yet. */
    public List<Path> all() {
        if (current == null || current.getParent() == null || !Files.isDirectory(current.getParent())) {
            return List.of();
        }
        String name = current.getFileName().toString();
        try (Stream<Path> files = Files.list(current.getParent())) {
            return files.filter(file -> file.getFileName().toString().startsWith(name) && Files.isRegularFile(file))
                    .sorted(Comparator.comparing((Path file) -> file.equals(current))
                            .thenComparing(LogFiles::modified)
                            .thenComparing(file -> file.getFileName().toString()))
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public long totalSize() {
        return all().stream().mapToLong(LogFiles::size).sum();
    }

    /** Reads a log file line by line; rotated files are gzip-compressed. */
    public static BufferedReader open(Path file) throws IOException {
        InputStream in = Files.newInputStream(file);
        if (file.getFileName().toString().endsWith(".gz")) {
            in = new GZIPInputStream(in);
        }
        return new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
    }

    static long modified(Path file) {
        try {
            return Files.getLastModifiedTime(file).toMillis();
        } catch (IOException e) {
            return 0;
        }
    }

    private static long size(Path file) {
        try {
            return Files.size(file);
        } catch (IOException e) {
            return 0;
        }
    }
}

package ru.teacherbox;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * {@code JdbcClient.query(Record.class)} uses {@code SimplePropertyRowMapper}, which makes H2 throw
 * and log a failed column lookup per property, and {@code DataClassRowMapper} still does for snake_case
 * columns (stage 419): records are read with
 * {@code RecordRowMapper.of(Record.class)}.
 */
class RowMapperTests {

    private static final Set<String> SCALARS =
            Set.of("UUID", "Long", "String", "Integer", "LocalDate", "Instant", "Boolean");
    private static final Pattern QUERY = Pattern.compile("\\.query\\((\\w+)\\.class\\)");

    @Test
    void recordsAreNotReadByClass() throws IOException {
        List<String> found;
        try (Stream<Path> files = Files.walk(Path.of("src/main/java"))) {
            found = files.filter(f -> f.toString().endsWith(".java"))
                    .flatMap(f -> QUERY.matcher(read(f)).results().map(m -> f + ": " + m.group()))
                    .filter(s -> !SCALARS.contains(s.substring(s.indexOf("query(") + 6, s.indexOf(".class"))))
                    .toList();
        }
        assertThat(found).as("use RecordRowMapper.of(X.class)").isEmpty();
    }

    private static String read(Path file) {
        try {
            return Files.readString(file);
        } catch (IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }
}

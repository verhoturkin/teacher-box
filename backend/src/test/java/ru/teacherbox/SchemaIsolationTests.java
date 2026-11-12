package ru.teacherbox;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * Data isolation (AGENTS.md §4.2 rule 3): a module's SQL (Java sources and migrations) must not
 * reference tables in another module's schema.
 */
class SchemaIsolationTests {

    private static final Path JAVA_ROOT = Path.of("src/main/java/ru/teacherbox");
    private static final Path MIGRATIONS_ROOT = Path.of("src/main/resources/db/migration");

    /** Every module that owns a schema: derived from the migration directories, so none can be left out. */
    static final List<String> MODULES = modulesWithMigrations();

    @Test
    void everyModuleWithMigrationsOrCodeIsChecked() throws IOException {
        assertThat(MODULES).as("modules found by migration directories").isNotEmpty().contains("textbooks");
        List<String> unchecked = new ArrayList<>();
        try (Stream<Path> dirs = Files.list(JAVA_ROOT)) {
            dirs.filter(Files::isDirectory)
                    .map(dir -> dir.getFileName().toString())
                    .filter(name -> !name.equals("shared") && !MODULES.contains(name))
                    .forEach(unchecked::add);
        }
        assertThat(unchecked).as("module packages without a migration directory").isEmpty();
    }

    @Test
    void modulesDoNotReferenceForeignSchemas() throws IOException {
        List<String> violations = new ArrayList<>();
        for (String module : MODULES) {
            for (Path file : sourcesOf(module)) {
                String content = Files.readString(file);
                for (String other : MODULES) {
                    if (!other.equals(module) && referencesSchema(content, other)) {
                        violations.add(file + " -> " + other);
                    }
                }
            }
        }
        assertThat(violations).as("cross-schema SQL references").isEmpty();
    }

    @Test
    void detectsSchemaReferencesInSql() {
        assertThat(referencesSchema("select * from billing.payments", "billing")).isTrue();
        assertThat(referencesSchema("SELECT 1 FROM x JOIN IDENTITY.USERS u", "identity")).isTrue();
        assertThat(referencesSchema("insert into homework.tasks values (1)", "homework")).isTrue();
        assertThat(referencesSchema("import ru.teacherbox.identity.api.StudentDirectory;", "identity")).isFalse();
    }

    static boolean referencesSchema(String content, String schema) {
        Pattern pattern = Pattern.compile(
                "(?i)\\b(from|join|into|update|table|references|exists)\\s+" + schema + "\\.");
        return pattern.matcher(content).find();
    }

    private static List<String> modulesWithMigrations() {
        try (Stream<Path> dirs = Files.list(MIGRATIONS_ROOT)) {
            return dirs.filter(Files::isDirectory).map(dir -> dir.getFileName().toString()).sorted().toList();
        } catch (IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }

    private static List<Path> sourcesOf(String module) throws IOException {
        List<Path> files = new ArrayList<>();
        for (Path dir : List.of(JAVA_ROOT.resolve(module), MIGRATIONS_ROOT.resolve(module))) {
            if (Files.isDirectory(dir)) {
                try (Stream<Path> walk = Files.walk(dir)) {
                    walk.filter(Files::isRegularFile).forEach(files::add);
                }
            }
        }
        return files;
    }
}

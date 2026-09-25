package ru.teacherbox.platform.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.bootstrap.DefaultBootstrapContext;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

class PendingRestoreTest {

    private static final Instant NOW = Instant.parse("2026-09-25T10:00:00Z");
    private static final String SCRIPT = """
            CREATE SCHEMA IF NOT EXISTS DEMO;
            CREATE TABLE DEMO.NOTES(ID INT PRIMARY KEY, TEXT VARCHAR(100));
            INSERT INTO DEMO.NOTES VALUES (1, 'из бэкапа');
            """;

    @TempDir
    Path dataDir;

    @Test
    void nothingToRestore() {
        assertThat(PendingRestore.restore(dataDir, url(), "sa", "", NOW)).isEmpty();
        assertThat(dataDir.resolve("restore")).doesNotExist();
    }

    @Test
    void restoresDatabaseAndFilesAndKeepsThePreviousState() throws Exception {
        Files.createDirectories(dataDir.resolve("files/old"));
        Files.writeString(dataDir.resolve("files/old/stale.txt"), "old");
        execute("CREATE TABLE CURRENT_STATE(ID INT)");
        Path archive = archive("teacherbox-20260925-033000-000.zip", Map.of(
                BackupArchive.DATABASE, SCRIPT,
                "files/homework/a.txt", "материал",
                BackupArchive.MANIFEST, "format=1"));

        Path applied = PendingRestore.restore(dataDir, url(), "sa", "", NOW).orElseThrow();

        assertThat(applied).isEqualTo(dataDir.resolve("restore/applied").resolve(archive.getFileName()));
        assertThat(archive).doesNotExist();
        assertThat(query("select TEXT from DEMO.NOTES where ID = 1")).isEqualTo("из бэкапа");
        assertThat(dataDir.resolve("files/homework/a.txt")).hasContent("материал");
        assertThat(dataDir.resolve("files/old")).doesNotExist();
        Path previous = dataDir.resolve("restore/previous-2026-09-25T10-00-00Z");
        assertThat(previous.resolve("files/old/stale.txt")).hasContent("old");
        assertThat(previous.resolve("db")).isDirectory();
    }

    @Test
    void failedRestoreBringsThePreviousStateBack() throws Exception {
        Files.createDirectories(dataDir.resolve("files"));
        Files.writeString(dataDir.resolve("files/keep.txt"), "keep");
        execute("CREATE TABLE KEEP_ME(ID INT)");
        Path archive = archive("broken.zip", Map.of("files/x.txt", "x"));

        assertThatThrownBy(() -> PendingRestore.restore(dataDir, url(), "sa", "", NOW))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("broken.zip");

        assertThat(archive).exists();
        assertThat(dataDir.resolve("files/keep.txt")).hasContent("keep");
        assertThat(dataDir.resolve("files/x.txt")).doesNotExist();
        assertThat(query("select count(*) from INFORMATION_SCHEMA.TABLES where TABLE_NAME = 'KEEP_ME'"))
                .isEqualTo("1");
    }

    @Test
    void rejectsEntriesOutsideTheDataDirectory() throws Exception {
        archive("evil.zip", Map.of(BackupArchive.DATABASE, SCRIPT, "files/../../evil.txt", "x"));

        assertThatThrownBy(() -> PendingRestore.restore(dataDir, url(), "sa", "", NOW))
                .isInstanceOf(IllegalStateException.class);
        assertThat(dataDir.getParent().resolve("evil.txt")).doesNotExist();
    }

    @Test
    void takesTheNewestOfSeveralArchives() throws Exception {
        archive("teacherbox-20260101-000000-000.zip", Map.of(BackupArchive.DATABASE, "CREATE TABLE OLDER(ID INT);"));
        archive("teacherbox-20260201-000000-000.zip", Map.of(BackupArchive.DATABASE, SCRIPT));

        assertThat(PendingRestore.restore(dataDir, url(), "sa", "", NOW)).get()
                .satisfies(path -> assertThat(path.getFileName().toString()).contains("20260201"));
        assertThat(query("select TEXT from DEMO.NOTES where ID = 1")).isEqualTo("из бэкапа");
    }

    @Test
    void listenerRestoresOnlyFileDatabases() throws Exception {
        archive("teacherbox-20260925-033000-000.zip", Map.of(BackupArchive.DATABASE, SCRIPT));
        PendingRestore listener = new PendingRestore();

        listener.onApplicationEvent(event(Map.of("spring.datasource.url", "jdbc:h2:mem:x",
                "teacherbox.data-dir", dataDir.toString())));
        assertThat(dataDir.resolve("restore/applied")).doesNotExist();

        listener.onApplicationEvent(event(Map.of("spring.datasource.url", url(),
                "teacherbox.data-dir", dataDir.toString())));
        assertThat(dataDir.resolve("restore/applied")).isDirectory();
        assertThat(listener.getOrder()).isGreaterThan(Integer.MIN_VALUE);
    }

    private String url() {
        return "jdbc:h2:file:" + dataDir.resolve("db/teacherbox").toAbsolutePath();
    }

    private Path archive(String name, Map<String, String> entries) throws IOException {
        Path archive = dataDir.resolve("restore").resolve(name);
        Files.createDirectories(archive.getParent());
        try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(archive))) {
            zip.putNextEntry(new ZipEntry("files/"));
            zip.closeEntry();
            for (Map.Entry<String, String> entry : entries.entrySet()) {
                zip.putNextEntry(new ZipEntry(entry.getKey()));
                zip.write(entry.getValue().getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return archive;
    }

    private void execute(String sql) throws SQLException {
        try (Connection connection = DriverManager.getConnection(url(), "sa", "")) {
            connection.createStatement().execute(sql);
        }
    }

    private String query(String sql) throws SQLException {
        try (Connection connection = DriverManager.getConnection(url(), "sa", "");
                ResultSet rs = connection.createStatement().executeQuery(sql)) {
            rs.next();
            return rs.getString(1);
        }
    }

    private static ApplicationEnvironmentPreparedEvent event(Map<String, Object> properties) {
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().addFirst(new MapPropertySource("test", properties));
        return new ApplicationEnvironmentPreparedEvent(new DefaultBootstrapContext(), new SpringApplication(),
                new String[0], environment);
    }
}

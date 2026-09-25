package ru.teacherbox.platform.backup;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.testing.TestUsers;

/** Backups of the running application and restoring them into a fresh database. */
@SpringBootTest(properties = "teacherbox.backup.keep=2")
@AutoConfigureMockMvc
class BackupIntegrationTest {

    private static final UUID TEACHER = UUID.randomUUID();

    @Autowired
    MockMvcTester mvc;

    @Autowired
    BackupService backups;

    @Autowired
    PlatformProperties platform;

    @BeforeEach
    void cleanUp() throws IOException {
        for (BackupService.BackupInfo backup : backups.list()) {
            backups.delete(backup.name());
        }
        Path material = platform.dataDir().resolve("files/homework/ab/material.txt");
        Files.createDirectories(material.getParent());
        Files.writeString(material, "условие");
    }

    @Test
    void teacherCreatesAndDownloadsABackup() throws IOException {
        MvcTestResult created = mvc.post().uri("/api/teacher/backups").with(TestUsers.teacher(TEACHER)).exchange();
        assertThat(created).hasStatus(HttpStatus.CREATED)
                .bodyJson().extractingPath("$.name").asString().matches("teacherbox-\\d{8}-\\d{6}-\\d{3}\\.zip");
        String name = backups.list().getFirst().name();

        assertThat(mvc.get().uri("/api/teacher/backups").with(TestUsers.teacher(TEACHER)))
                .hasStatusOk()
                .bodyJson().extractingPath("$[0].name").isEqualTo(name);
        MvcTestResult download = mvc.get().uri("/api/teacher/backups/" + name).with(TestUsers.teacher(TEACHER))
                .exchange();
        assertThat(download).hasStatusOk().hasContentType("application/zip")
                .hasHeader("Cache-Control", "no-store");

        Map<String, String> entries = unzip(download.getResponse().getContentAsByteArray());
        assertThat(entries.get(BackupArchive.MANIFEST)).contains("format=1");
        assertThat(entries.get(BackupArchive.DATABASE))
                .contains("CREATE SCHEMA IF NOT EXISTS \"IDENTITY\"")
                .contains("\"flyway_schema_history\"");
        assertThat(entries.get("files/homework/ab/material.txt")).isEqualTo("условие");
    }

    @Test
    void keepsOnlyTheNewestBackups() {
        String first = backups.create().name();
        String second = backups.create().name();
        String third = backups.create().name();

        assertThat(backups.list()).extracting(BackupService.BackupInfo::name).containsExactly(third, second);
        assertThat(first).isLessThan(second);
    }

    @Test
    void deletesAndRejectsUnknownNames() {
        String name = backups.create().name();

        assertThat(mvc.delete().uri("/api/teacher/backups/" + name).with(TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.NO_CONTENT);
        assertThat(backups.list()).isEmpty();
        assertThat(mvc.get().uri("/api/teacher/backups/" + name).with(TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.NOT_FOUND)
                .bodyJson().extractingPath("$.code").isEqualTo("backup.not-found");
        assertThat(mvc.get().uri("/api/teacher/backups/..%2Fdb%2Fteacherbox.mv.db").with(TestUsers.teacher(TEACHER)))
                .as("rejected by the firewall before reaching the controller")
                .hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(mvc.get().uri("/api/teacher/backups/teacherbox.mv.db").with(TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    void onlyTheTeacherManagesBackups() {
        assertThat(mvc.post().uri("/api/teacher/backups").with(TestUsers.student(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri("/api/teacher/backups")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void backupIsRestoredIntoAFreshDatabase(@TempDir Path target) throws IOException, SQLException {
        Path archive = platform.dataDir().resolve("backups").resolve(backups.create().name());
        Files.createDirectories(target.resolve("restore"));
        Files.copy(archive, target.resolve("restore").resolve(archive.getFileName()));
        String url = "jdbc:h2:file:" + target.resolve("db/teacherbox").toAbsolutePath();

        assertThat(PendingRestore.restore(target, url, "sa", "", Instant.now())).isPresent();

        try (Connection connection = DriverManager.getConnection(url, "sa", "");
                ResultSet teachers = connection.createStatement()
                        .executeQuery("select count(*) from identity.users where role = 'TEACHER'")) {
            teachers.next();
            assertThat(teachers.getInt(1)).isEqualTo(1);
        }
        assertThat(target.resolve("files/homework/ab/material.txt")).hasContent("условие");
    }

    private static Map<String, String> unzip(byte[] bytes) throws IOException {
        Map<String, String> entries = new HashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            for (ZipEntry entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                entries.put(entry.getName(), new String(zip.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        return entries;
    }
}

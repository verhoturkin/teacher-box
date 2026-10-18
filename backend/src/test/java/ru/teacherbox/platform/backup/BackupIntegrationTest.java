package ru.teacherbox.platform.backup;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.nio.file.attribute.FileTime;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.testing.TestUsers;

/** Backups of the running application and restoring them into a fresh database. */
@SpringBootTest(properties = "teacherbox.backup.keep-days=3")
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
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$[0].name").isEqualTo(name);
                    assertThat(json).extractingPath("$[0].kind").isEqualTo("MANUAL");
                    assertThat(json).extractingPath("$[0].version").isNotNull();
                });
        MvcTestResult download = mvc.get().uri("/api/teacher/backups/" + name).with(TestUsers.teacher(TEACHER))
                .exchange();
        assertThat(download).hasStatusOk().hasContentType("application/zip")
                .hasHeader("Cache-Control", "no-store");

        Map<String, String> entries = unzip(download.getResponse().getContentAsByteArray());
        assertThat(entries.get(BackupArchive.MANIFEST)).contains("format=1").contains("kind=MANUAL")
                .contains("version=");
        assertThat(entries.get(BackupArchive.DATABASE))
                .contains("CREATE SCHEMA IF NOT EXISTS \"IDENTITY\"")
                .contains("\"flyway_schema_history\"");
        assertThat(entries.get("files/homework/ab/material.txt")).isEqualTo("условие");
    }

    @Test
    void backupsOfEveryKindOlderThanTheRetentionAreDeletedAfterANewOne() throws IOException {
        String scheduled = backups.create(BackupKind.SCHEDULED).name();
        String beforeReset = backups.create(BackupKind.BEFORE_RESET).name();
        String beforeRestore = backups.create(BackupKind.BEFORE_RESTORE).name();
        String recent = backups.create().name();
        age(scheduled, Duration.ofDays(4));
        age(beforeReset, Duration.ofDays(4));
        age(beforeRestore, Duration.ofDays(3).plusMinutes(1));
        age(recent, Duration.ofDays(2));
        assertThat(backups.list()).hasSize(4);

        String newest = backups.create(BackupKind.SCHEDULED).name();

        assertThat(backups.list()).extracting(BackupService.BackupInfo::name).containsExactly(newest, recent);
        assertThat(backups.info(newest).kind()).isEqualTo(BackupKind.SCHEDULED);
        assertThat(backups.info(recent).kind()).isEqualTo(BackupKind.MANUAL);
    }

    @Test
    void anUnknownKindIsNone() throws IOException {
        Path other = platform.dataDir().resolve("backups/teacherbox-20200101-000000-000.zip");
        Files.createDirectories(other.getParent());
        try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(other))) {
            zip.putNextEntry(new ZipEntry(BackupArchive.MANIFEST));
            zip.write("format=1\nkind=SOMETHING\n".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }

        assertThat(backups.info(other.getFileName().toString()).kind()).isNull();
    }

    private void age(String name, Duration age) throws IOException {
        Files.setLastModifiedTime(backups.file(name), FileTime.from(Instant.now().minus(age)));
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

    @Test
    void aBoardKeepsOnlyItsSceneAndItsImagesThroughABackup(@TempDir Path target) throws IOException, SQLException {
        MvcTestResult created = mvc.post().uri("/api/teacher/boards").with(TestUsers.teacher(TEACHER))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"kind\":\"EXCALIDRAW\",\"title\":\"Доска\"}").exchange();
        String board = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 13};
        byte[] unused = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 14};
        assertThat(mvc.put().uri("/api/boards/" + board + "/files/img1").with(TestUsers.teacher(TEACHER))
                .contentType("image/png").content(png)).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.put().uri("/api/boards/" + board + "/files/img2").with(TestUsers.teacher(TEACHER))
                .contentType("image/png").content(unused)).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(mvc.put().uri("/api/boards/" + board + "/scene").with(TestUsers.teacher(TEACHER))
                .contentType(MediaType.APPLICATION_JSON).content("""
                        {"elements":[{"id":"i","type":"image","fileId":"img1","version":1,"versionNonce":1}],
                         "baseVersion":0}""")).hasStatusOk();
        assertThat(mvc.post().uri("/api/teacher/boards/" + board + "/backups").with(TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.CREATED);
        Path archive = platform.dataDir().resolve("backups").resolve(backups.create().name());
        Files.createDirectories(target.resolve("restore"));
        Files.copy(archive, target.resolve("restore").resolve(archive.getFileName()));
        String url = "jdbc:h2:file:" + target.resolve("db/teacherbox").toAbsolutePath();

        assertThat(PendingRestore.restore(target, url, "sa", "", Instant.now())).isPresent();

        try (Connection connection = DriverManager.getConnection(url, "sa", "");
                ResultSet rows = connection.createStatement().executeQuery("""
                        select s.elements, (select count(*) from boards.board_backups b where b.board_id = s.board_id),
                            (select f.file_key from boards.board_files f where f.board_id = s.board_id
                                and f.file_id = 'img1'),
                            (select f.file_key from boards.board_files f where f.board_id = s.board_id
                                and f.file_id = 'img2')
                        from boards.board_scenes s where s.board_id = '%s'""".formatted(board))) {
            assertThat(rows.next()).isTrue();
            assertThat(rows.getString(1)).contains("\"fileId\":\"img1\"");
            assertThat(rows.getInt(2)).as("copies stay out").isZero();
            assertThat(target.resolve("files/boards").resolve(rows.getString(3))).hasBinaryContent(png);
            assertThat(target.resolve("files/boards").resolve(rows.getString(4)))
                    .as("an image no scene uses stays out").doesNotExist();
        }
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

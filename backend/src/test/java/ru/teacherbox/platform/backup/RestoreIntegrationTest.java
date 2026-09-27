package ru.teacherbox.platform.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.shared.security.PasswordConfirmation;
import ru.teacherbox.testing.TestUsers;

/** Restoring a backup from the interface (ADR-0014): checks, the safety backup and the restart. */
@SpringBootTest(properties = "teacherbox.backup.restart=true")
@AutoConfigureMockMvc
class RestoreIntegrationTest {

    private static final UUID TEACHER = UUID.randomUUID();
    private static final UUID ADMIN = UUID.randomUUID();

    @Autowired
    MockMvcTester mvc;

    @Autowired
    BackupService backups;

    @Autowired
    PlatformProperties platform;

    @MockitoBean
    Restarter restarter;

    @MockitoBean
    PasswordConfirmation passwords;

    @BeforeEach
    void passwords() {
        when(passwords.matches(any(), anyString())).thenReturn(false);
        when(passwords.matches(TEACHER, "teacher-password")).thenReturn(true);
        when(passwords.matches(ADMIN, "admin-password")).thenReturn(true);
    }

    @AfterEach
    void cleanUp() throws IOException {
        for (Path dir : new Path[] {platform.dataDir().resolve("backups"), platform.dataDir().resolve("restore")}) {
            if (Files.exists(dir)) {
                try (Stream<Path> tree = Files.walk(dir)) {
                    for (Path path : tree.sorted(Comparator.reverseOrder()).toList()) {
                        Files.delete(path);
                    }
                }
            }
        }
        clearInvocations(restarter);
    }

    @Test
    void theTeacherRestoresABackupAfterASafetyBackup() {
        String name = backups.create().name();

        assertThat(restore("/api/teacher/backups/", name, "wrong", TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("password.wrong-current");
        verify(restarter, never()).restartSoon();

        MvcTestResult restored = restore("/api/teacher/backups/", name, "teacher-password", TestUsers.teacher(TEACHER));

        assertThat(restored).hasStatus(HttpStatus.ACCEPTED).bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.archive").isEqualTo(name);
            assertThat(json).extractingPath("$.restarting").isEqualTo(true);
        });
        verify(restarter).restartSoon();
        assertThat(platform.dataDir().resolve("restore").resolve(name)).exists();
        assertThat(backups.list()).as("the safety backup and the restored one")
                .extracting(BackupService.BackupInfo::kind)
                .containsExactly(BackupKind.BEFORE_RESTORE, BackupKind.MANUAL);
        assertThat(mvc.get().uri("/api/teacher/backups/restore").with(TestUsers.teacher(TEACHER)))
                .hasStatusOk().bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.pending").isEqualTo(name);
                    assertThat(json).extractingPath("$.restartEnabled").isEqualTo(true);
                    assertThat(json).extractingPath("$.startedAt").isNotNull();
                    assertThat(json).extractingPath("$.lastRestore").isNull();
                });
    }

    @Test
    void theAdministratorSeesCreatesAndRestoresButDoesNotDownload() {
        assertThat(mvc.post().uri("/api/admin/backups").with(TestUsers.admin(ADMIN))).hasStatus(HttpStatus.CREATED)
                .bodyJson().extractingPath("$.kind").isEqualTo("MANUAL");
        String name = backups.list().getFirst().name();
        assertThat(mvc.get().uri("/api/admin/backups").with(TestUsers.admin(ADMIN))).hasStatusOk()
                .bodyJson().extractingPath("$[0].name").isEqualTo(name);
        assertThat(mvc.get().uri("/api/admin/backups/" + name).with(TestUsers.admin(ADMIN)))
                .hasStatus(HttpStatus.NOT_FOUND);

        assertThat(restore("/api/admin/backups/", name, "teacher-password", TestUsers.admin(ADMIN)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(restore("/api/admin/backups/", name, "admin-password", TestUsers.admin(ADMIN)))
                .hasStatus(HttpStatus.ACCEPTED);
        verify(restarter).restartSoon();
        assertThat(mvc.get().uri("/api/admin/backups/restore").with(TestUsers.admin(ADMIN))).hasStatusOk()
                .bodyJson().extractingPath("$.pending").isEqualTo(name);
    }

    @Test
    void aNewRequestReplacesTheWaitingOne() throws IOException {
        String first = backups.create().name();
        String second = backups.create().name();
        restore("/api/teacher/backups/", first, "teacher-password", TestUsers.teacher(TEACHER));

        restore("/api/teacher/backups/", second, "teacher-password", TestUsers.teacher(TEACHER));

        try (Stream<Path> waiting = Files.list(platform.dataDir().resolve("restore"))) {
            assertThat(waiting.map(path -> path.getFileName().toString())).containsExactly(second);
        }
    }

    @Test
    void rejectsBackupsOfANewerPortalAndDamagedOnes() throws IOException {
        Path newer = archive("teacherbox-20990101-000000-000.zip",
                Map.of(BackupArchive.MANIFEST, "format=1\nversion=99.0.0\n", BackupArchive.DATABASE, "select 1;"));
        Path future = archive("teacherbox-20990102-000000-000.zip",
                Map.of(BackupArchive.MANIFEST, "format=2\n", BackupArchive.DATABASE, "select 1;"));
        Path noDatabase = archive("teacherbox-20990103-000000-000.zip", Map.of(BackupArchive.MANIFEST, "format=1\n"));
        Path garbage = archive("teacherbox-20990104-000000-000.zip",
                Map.of(BackupArchive.MANIFEST, "format=first\n", BackupArchive.DATABASE, "select 1;"));
        Path notAZip = backups.file(backups.create().name()).resolveSibling("teacherbox-20990105-000000-000.zip");
        Files.writeString(notAZip, "not a zip");

        assertThat(restoreFile(newer)).bodyJson().extractingPath("$.code").isEqualTo("backup.newer-version");
        assertThat(restoreFile(future)).bodyJson().extractingPath("$.code").isEqualTo("backup.newer-version");
        assertThat(restoreFile(noDatabase)).bodyJson().extractingPath("$.code").isEqualTo("backup.damaged");
        assertThat(restoreFile(garbage)).bodyJson().extractingPath("$.code").isEqualTo("backup.damaged");
        assertThat(restoreFile(notAZip)).bodyJson().extractingPath("$.code").isEqualTo("backup.damaged");
        assertThat(restore("/api/teacher/backups/", "teacherbox-20000101-000000-000.zip", "teacher-password",
                TestUsers.teacher(TEACHER))).hasStatus(HttpStatus.NOT_FOUND);
        verify(restarter, never()).restartSoon();
    }

    @Test
    void showsTheOutcomeOfTheLatestRestore() throws IOException {
        Path restoreDir = platform.dataDir().resolve("restore");
        Files.createDirectories(restoreDir);
        Files.writeString(restoreDir.resolve(PendingRestore.RESULT),
                "status=FAILED\narchive=teacherbox-20260925-033000-000.zip\nat=2026-09-27T10:00:00Z\nerror=broken\n");

        assertThat(mvc.get().uri("/api/teacher/backups/restore").with(TestUsers.teacher(TEACHER))).hasStatusOk()
                .bodyJson().satisfies(json -> {
                    assertThat(json).extractingPath("$.lastRestore.restored").isEqualTo(false);
                    assertThat(json).extractingPath("$.lastRestore.error").isEqualTo("broken");
                    assertThat(json).extractingPath("$.lastRestore.at").isEqualTo("2026-09-27T10:00:00Z");
                    assertThat(json).extractingPath("$.pending").isNull();
                });
        Files.writeString(restoreDir.resolve(PendingRestore.RESULT), "status=RESTORED\n");
        assertThat(mvc.get().uri("/api/teacher/backups/restore").with(TestUsers.teacher(TEACHER))).hasStatusOk()
                .bodyJson().extractingPath("$.lastRestore").isNull();
        assertThat(Instant.parse("2026-09-27T10:00:00Z")).isBefore(Instant.now());
    }

    @Test
    void onlyTheTeacherAndTheAdministratorRestore() {
        String name = backups.create().name();

        assertThat(restore("/api/teacher/backups/", name, "x", TestUsers.student(UUID.randomUUID())))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(restore("/api/admin/backups/", name, "teacher-password", TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(restore("/api/teacher/backups/", name, "admin-password", TestUsers.admin(ADMIN)))
                .hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.post().uri("/api/teacher/backups/" + name + "/restore").with(TestUsers.teacher(TEACHER))
                .contentType(MediaType.APPLICATION_JSON).content("{}")).hasStatus(HttpStatus.BAD_REQUEST);
        verify(restarter, never()).restartSoon();
    }

    private MvcTestResult restoreFile(Path archive) {
        MvcTestResult result = restore("/api/teacher/backups/", archive.getFileName().toString(), "teacher-password",
                TestUsers.teacher(TEACHER));
        assertThat(result).hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        return result;
    }

    private MvcTestResult restore(String base, String name, String password, RequestPostProcessor user) {
        return mvc.post().uri(base + name + "/restore").with(user).contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"" + password + "\"}").exchange();
    }

    private Path archive(String name, Map<String, String> entries) throws IOException {
        Path archive = platform.dataDir().resolve("backups").resolve(name);
        Files.createDirectories(archive.getParent());
        try (OutputStream out = Files.newOutputStream(archive); ZipOutputStream zip = new ZipOutputStream(out)) {
            for (Map.Entry<String, String> entry : entries.entrySet()) {
                zip.putNextEntry(new ZipEntry(entry.getKey()));
                zip.write(entry.getValue().getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return archive;
    }
}

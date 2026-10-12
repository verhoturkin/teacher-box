package ru.teacherbox.platform.backup.drive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
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
import ru.teacherbox.platform.backup.BackupService;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.shared.diagnostics.IntegrationCheck.State;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.testing.TestUsers;

/** The teacher's Google Drive for the backups through REST, with the Drive API mocked (ADR-0037). */
@SpringBootTest
@AutoConfigureMockMvc
class DriveIntegrationTest {

    private static final UUID TEACHER = UUID.randomUUID();
    private static final String URI = "/api/teacher/backups/google";

    @Autowired
    MockMvcTester mvc;

    @Autowired
    BackupService backups;

    @Autowired
    PlatformProperties platform;

    @Autowired
    DriveIntegrationCheck check;

    @MockitoBean
    DriveApi api;

    @BeforeEach
    @AfterEach
    void cleanUp() throws IOException {
        Files.deleteIfExists(platform.dataDir().resolve("google-drive.json"));
        for (BackupService.BackupInfo backup : backups.list()) {
            backups.delete(backup.name());
        }
    }

    @Test
    void theTeacherEntersAClientAndStartsTheAuthorization() {
        assertThat(mvc.get().uri(URI).with(TestUsers.teacher(TEACHER))).hasStatusOk().bodyJson().satisfies(json -> {
            assertThat(json).extractingPath("$.clientConfigured").isEqualTo(false);
            assertThat(json).extractingPath("$.connected").isEqualTo(false);
            assertThat(json).extractingPath("$.callbackPath").isEqualTo(CloudBackupService.CALLBACK_PATH);
        });
        assertThat(mvc.put().uri(URI + "/client").with(TestUsers.teacher(TEACHER))
                .contentType(MediaType.APPLICATION_JSON).content("{\"clientId\":\"id\",\"clientSecret\":\"secret\"}"))
                .hasStatusOk().bodyJson().extractingPath("$.clientId").isEqualTo("id");
        assertThat(mvc.put().uri(URI + "/client").with(TestUsers.teacher(TEACHER))
                .contentType(MediaType.APPLICATION_JSON).content("{\"clientId\":\"\",\"clientSecret\":\"secret\"}"))
                .hasStatus(HttpStatus.BAD_REQUEST);
        when(api.authorizationUrl(eq("id"), anyString(), anyString())).thenReturn("https://consent");

        assertThat(mvc.post().uri(URI + "/authorize").with(TestUsers.teacher(TEACHER))
                .contentType(MediaType.APPLICATION_JSON).content("{\"origin\":\"https://school.example.com\"}"))
                .hasStatusOk().bodyJson().extractingPath("$.url").isEqualTo("https://consent");
        assertThat(mvc.get().uri(CloudBackupService.CALLBACK_PATH + "?state=unknown&code=c"))
                .hasStatus(HttpStatus.FOUND)
                .hasHeader("Location", "/teacher/settings?drive=expired#backups");
    }

    @Test
    void onlyTheTeacherManagesTheDrive() {
        assertThat(mvc.get().uri(URI).with(TestUsers.student(UUID.randomUUID()))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(URI).with(TestUsers.admin(UUID.randomUUID()))).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(mvc.get().uri(URI + "/files")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void withoutTheDriveNothingIsSentOrListed() {
        String name = backups.create().name();

        assertThat(mvc.post().uri(URI + "/uploads/" + name).with(TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .bodyJson().extractingPath("$.code").isEqualTo("backup.google-not-connected");
        assertThat(mvc.get().uri(URI + "/files").with(TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(check.check()).singleElement().extracting(status -> status.state()).isEqualTo(State.NOT_CONFIGURED);
    }

    @Test
    void aNewBackupGoesToTheDriveAndACopyComesBack() throws IOException {
        connect();
        when(api.refresh(any(), eq("refresh"))).thenReturn(new DriveApi.Tokens("access", 3600, null));
        when(api.folderExists("access", "folder-1")).thenReturn(true);
        when(api.list("access", "folder-1")).thenReturn(List.of());

        String name = mvc.post().uri("/api/teacher/backups").with(TestUsers.teacher(TEACHER)).exchange()
                .getResponse().getContentAsString().replaceAll(".*\"name\":\"([^\"]+)\".*", "$1");

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                verify(api).upload(eq("access"), eq("folder-1"), eq(backups.file(name))));
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertThat(mvc.get().uri(URI).with(TestUsers.teacher(TEACHER))).bodyJson()
                        .extractingPath("$.lastUploadName").isEqualTo(name));

        Path archive = Files.copy(backups.file(name), platform.dataDir().resolve("cloud-copy.zip"),
                StandardCopyOption.REPLACE_EXISTING);
        backups.delete(name);
        when(api.list("access", "folder-1"))
                .thenReturn(List.of(new DriveApi.DriveFile("file-1", name, Files.size(archive), null)));
        doAnswer(call -> Files.copy(archive, call.<Path>getArgument(2), StandardCopyOption.REPLACE_EXISTING))
                .when(api).download(eq("access"), eq("file-1"), any());

        assertThat(mvc.get().uri(URI + "/files").with(TestUsers.teacher(TEACHER))).hasStatusOk().bodyJson()
                .extractingPath("$[0].name").isEqualTo(name);
        assertThat(mvc.post().uri(URI + "/files/file-1/download").with(TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.ACCEPTED).bodyJson().extractingPath("$.name").isEqualTo(name);
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertThat(backups.list()).extracting(BackupService.BackupInfo::name).contains(name));
        assertThat(mvc.post().uri(URI + "/uploads/" + name).with(TestUsers.teacher(TEACHER)))
                .hasStatus(HttpStatus.ACCEPTED);
        Files.delete(archive);
    }

    @Test
    void theAdministratorSeesWhetherTheDriveAnswers() {
        connect();
        when(api.refresh(any(), eq("refresh"))).thenReturn(new DriveApi.Tokens("access", 3600, null));
        when(api.account("access")).thenReturn("teacher@example.com").thenThrow(new DriveException("offline"));

        assertThat(check.check()).singleElement().satisfies(status -> {
            assertThat(status.state()).isEqualTo(State.OK);
            assertThat(status.detail()).doesNotContain("teacher@example.com");
        });
        assertThat(check.check()).singleElement().extracting(status -> status.state()).isEqualTo(State.FAILED);
    }

    @Test
    void theTeacherDisconnects() {
        connect();

        assertThat(mvc.delete().uri(URI).with(TestUsers.teacher(TEACHER))).hasStatus(HttpStatus.NO_CONTENT);
        verify(api).revoke("refresh");
        assertThat(mvc.get().uri(URI).with(TestUsers.teacher(TEACHER))).bodyJson()
                .extractingPath("$.connected").isEqualTo(false);
    }

    @Test
    void onlyABackupOfThePortalIsTakenFromElsewhere() throws IOException {
        String name = backups.create().name();
        Path archive = backups.file(name);

        assertThatThrownBy(() -> backups.adopt(name, partial -> { })).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> backups.adopt("notes.zip", partial -> { })).isInstanceOf(BusinessRuleException.class);
        String other = "teacherbox-20200101-000000-000.zip";
        assertThatThrownBy(() -> backups.adopt(other, partial -> write(partial, "not a zip")))
                .isInstanceOf(BusinessRuleException.class);
        assertThat(platform.dataDir().resolve("backups").resolve(other + ".part")).doesNotExist();

        assertThat(backups.adopt(other, partial -> copy(archive, partial)).name()).isEqualTo(other);
        assertThat(backups.list()).extracting(BackupService.BackupInfo::name).contains(name, other);
    }

    private void connect() {
        new DriveConnectionStore(platform.dataDir().resolve("google-drive.json"),
                tools.jackson.databind.json.JsonMapper.builder().build())
                .update(connection -> connection.withClient("id", "secret")
                        .connected("refresh", "folder-1", "teacher@example.com", java.time.Instant.now()));
    }

    private static void write(Path file, String content) {
        try {
            Files.writeString(file, content);
        } catch (IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }

    private static void copy(Path from, Path to) {
        try {
            Files.copy(from, to, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }
}

package ru.teacherbox.platform.backup.drive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import ru.teacherbox.platform.backup.BackupCreated;
import ru.teacherbox.platform.backup.BackupKind;
import ru.teacherbox.platform.backup.BackupProperties;
import ru.teacherbox.platform.backup.BackupService;
import ru.teacherbox.platform.backup.BackupService.BackupInfo;
import ru.teacherbox.platform.backup.drive.CloudBackupService.AuthorizationResult;
import ru.teacherbox.platform.backup.drive.CloudBackupService.CloudBackup;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.portal.Portal;
import ru.teacherbox.testing.MutableClock;
import tools.jackson.databind.json.JsonMapper;

/** The Drive connection, uploads with rotation and taking copies back, against a mocked Drive API. */
class CloudBackupServiceTest {

    private static final String B1 = "teacherbox-20261010-033000-000.zip";
    private static final String B2 = "teacherbox-20261011-033000-000.zip";
    private static final String B3 = "teacherbox-20261012-033000-000.zip";

    @TempDir
    Path dir;

    private final DriveApi api = mock(DriveApi.class);
    private final BackupService backups = mock(BackupService.class);
    private final Portal portal = mock(Portal.class);
    private final MutableClock clock = new MutableClock(Instant.parse("2026-10-12T10:00:00Z"));
    private DriveConnectionStore store;
    private CloudBackupService drive;

    @BeforeEach
    void setUp() {
        store = new DriveConnectionStore(dir.resolve("google-drive.json"), JsonMapper.builder().build());
        drive = service(google(null, null));
        when(portal.name()).thenReturn("Школа");
        when(portal.link(anyString())).thenReturn(Optional.empty());
        when(api.authorizationUrl(anyString(), anyString(), anyString()))
                .thenAnswer(call -> "https://consent?state=" + call.getArgument(2));
        when(api.refresh(any(), anyString())).thenReturn(new DriveApi.Tokens("access", 3600, null));
    }

    @Test
    void theTeacherEntersAClientAndConnects() {
        assertThat(drive.status().clientConfigured()).isFalse();
        assertThatThrownBy(() -> drive.authorize("https://school")).isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("client id");
        assertThatThrownBy(() -> drive.saveClient(" ", "s")).isInstanceOf(BusinessRuleException.class);

        drive.saveClient(" id ", " secret ");
        String state = state(drive.authorize("https://school.example.com:8443/teacher/settings"));
        when(api.exchangeCode(new DriveApi.Client("id", "secret"), "code",
                "https://school.example.com:8443" + CloudBackupService.CALLBACK_PATH))
                .thenReturn(new DriveApi.Tokens("access", 3600, "refresh"));
        when(api.createFolder("access", "Школа")).thenReturn("folder-1");
        when(api.account("access")).thenReturn("teacher@example.com");

        assertThat(drive.complete(state, "code", null)).isEqualTo(AuthorizationResult.CONNECTED);
        assertThat(drive.complete(state, "code", null)).as("a state works once").isEqualTo(AuthorizationResult.EXPIRED);
        var status = drive.status();
        assertThat(status.connected()).isTrue();
        assertThat(status.account()).isEqualTo("teacher@example.com");
        assertThat(status.clientId()).isEqualTo("id");
        assertThat(status.clientFromEnvironment()).isFalse();
        assertThat(status.connectedAt()).isEqualTo(clock.instant());
        assertThat(store.load().folderId()).isEqualTo("folder-1");
    }

    @Test
    void reconnectingReusesTheFolder() {
        store.update(connection -> connection.withClient("id", "secret").withFolder("folder-1"));
        when(portal.link(CloudBackupService.CALLBACK_PATH)).thenReturn(Optional.of("https://portal/cb"));
        String state = state(drive.authorize("ignored"));
        when(api.exchangeCode(any(), eq("code"), eq("https://portal/cb")))
                .thenReturn(new DriveApi.Tokens("access", 3600, "refresh"));
        when(api.folderExists("access", "folder-1")).thenReturn(true);
        when(api.account("access")).thenReturn("");

        assertThat(drive.complete(state, "code", null)).isEqualTo(AuthorizationResult.CONNECTED);
        verify(api, never()).createFolder(anyString(), anyString());
        assertThat(drive.status().account()).isNull();
    }

    @Test
    void anAuthorizationCanBeDeclinedExpiredOrFail() {
        drive.saveClient("id", "secret");
        assertThat(drive.complete(null, "code", null)).isEqualTo(AuthorizationResult.EXPIRED);
        assertThat(drive.complete("unknown", "code", null)).isEqualTo(AuthorizationResult.EXPIRED);
        assertThat(drive.complete(state(drive.authorize("https://school")), null, "access_denied"))
                .isEqualTo(AuthorizationResult.DENIED);

        String old = state(drive.authorize("https://school"));
        clock.advance(Duration.ofMinutes(11));
        assertThat(drive.complete(old, "code", null)).isEqualTo(AuthorizationResult.EXPIRED);

        when(api.exchangeCode(any(), anyString(), anyString())).thenReturn(new DriveApi.Tokens("access", 3600, null));
        assertThat(drive.complete(state(drive.authorize("https://school")), "code", null))
                .isEqualTo(AuthorizationResult.FAILED);
        assertThat(drive.status().lastError()).contains("refresh token");
        assertThat(drive.status().connected()).isFalse();

        assertThatThrownBy(() -> drive.authorize("ftp://school")).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> drive.authorize("not an address")).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> drive.authorize("https:")).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void theClientFromTheEnvironmentWins() {
        CloudBackupService fromEnvironment = service(google(" env-id ", "env-secret"));

        assertThat(fromEnvironment.status().clientId()).isEqualTo("env-id");
        assertThat(fromEnvironment.status().clientFromEnvironment()).isTrue();
        assertThatThrownBy(() -> fromEnvironment.saveClient("id", "secret")).isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("environment");
    }

    @Test
    void scheduledAndManualBackupsGoToTheDriveAndOldOnesAreDeleted() throws IOException {
        connect();
        Path file = Files.writeString(dir.resolve(B3), "zip");
        when(backups.file(B3)).thenReturn(file);
        when(api.folderExists("access", "folder-1")).thenReturn(true);
        when(api.list("access", "folder-1")).thenReturn(List.of(cloud("3", B3), cloud("x", "notes.zip", 30),
                cloud("2", B2, 13), cloud("1", B1, 15), cloud("0", B1.replace("10-", "09-"))));

        drive.on(new BackupCreated(info(B3), BackupKind.SCHEDULED));

        verify(api).upload("access", "folder-1", file);
        verify(api).delete("access", "1");
        verify(api, never()).delete("access", "2");
        verify(api, never()).delete("access", "x");
        verify(api, never()).delete("access", "0");
        assertThat(drive.status().lastUploadName()).isEqualTo(B3);
        assertThat(drive.status().lastUploadAt()).isEqualTo(clock.instant());
        assertThat(drive.status().running()).isNull();
    }

    @Test
    void backupsBeforeARestoreOrAResetAndBackupsWithoutTheDriveStayOnTheServer() {
        drive.on(new BackupCreated(info(B1), BackupKind.MANUAL));
        connect();
        drive.on(new BackupCreated(info(B1), BackupKind.BEFORE_RESTORE));
        drive.on(new BackupCreated(info(B1), BackupKind.BEFORE_RESET));

        verify(api, never()).upload(anyString(), anyString(), any());
    }

    @Test
    void aDeletedFolderIsMadeAgainAndAFailedUploadIsShown() throws IOException {
        connect();
        when(backups.file(B1)).thenReturn(Files.writeString(dir.resolve(B1), "zip"));
        when(api.folderExists("access", "folder-1")).thenReturn(false);
        when(api.createFolder("access", "Школа")).thenReturn("folder-2");
        when(api.upload(eq("access"), eq("folder-2"), any())).thenThrow(new DriveException("quota exceeded"));

        drive.requestUpload(B1);

        assertThat(store.load().folderId()).isEqualTo("folder-2");
        assertThat(drive.status().lastError()).isEqualTo("quota exceeded");
        assertThat(drive.status().connected()).isTrue();
    }

    @Test
    void aRejectedTokenIsRefreshedOnceThenTheDriveIsDisconnected() throws IOException {
        connect();
        when(backups.file(B1)).thenReturn(Files.writeString(dir.resolve(B1), "zip"));
        when(api.folderExists("access", "folder-1")).thenThrow(new DriveAuthException("401")).thenReturn(true);
        when(api.list("access", "folder-1")).thenReturn(List.of());

        drive.requestUpload(B1);
        verify(api).upload(eq("access"), eq("folder-1"), any());

        when(api.refresh(any(), anyString())).thenThrow(new DriveAuthException("invalid_grant"));
        clock.advance(Duration.ofHours(2));
        drive.requestUpload(B1);

        assertThat(drive.status().connected()).isFalse();
        assertThat(drive.status().lastError()).isEqualTo("invalid_grant");
        assertThatThrownBy(() -> drive.requestUpload(B1)).isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("not connected");
    }

    @Test
    void anUnknownBackupIsNotUploaded() {
        connect();
        when(backups.file("missing.zip")).thenThrow(new NotFoundException("backup.not-found", "Backup not found"));

        assertThatThrownBy(() -> drive.requestUpload("missing.zip")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void aBackupGoneBeforeItsUploadIsShownAsAnError() {
        connect();
        when(api.folderExists("access", "folder-1")).thenReturn(true);
        when(backups.file(B1)).thenThrow(new NotFoundException("backup.not-found", "Backup not found"));

        drive.upload(B1);

        assertThat(drive.status().lastError()).isEqualTo("Backup not found");
    }

    @Test
    void listsTheBackupsInTheDriveAndBringsOneToTheServer() {
        assertThatThrownBy(() -> drive.list()).isInstanceOf(BusinessRuleException.class);
        connect();
        when(api.list("access", "folder-1")).thenReturn(List.of(cloud("2", B2), cloud("x", "notes.zip"),
                cloud("1", B1)));
        when(backups.list()).thenReturn(List.of(info(B1)));
        doAnswer(call -> {
            Consumer<Path> writer = call.getArgument(1);
            writer.accept(dir.resolve(B2 + ".part"));
            return info(B2);
        }).when(backups).adopt(eq(B2), any());

        assertThat(drive.list()).extracting(CloudBackup::name).containsExactly(B2, B1);
        assertThatThrownBy(() -> drive.requestDownload("x")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> drive.requestDownload("1")).isInstanceOf(ConflictException.class);
        assertThat(drive.requestDownload("2").name()).isEqualTo(B2);

        verify(api).download("access", "2", dir.resolve(B2 + ".part"));
        assertThat(drive.status().lastError()).isNull();
    }

    @Test
    void aFailedDownloadIsShown() {
        connect();
        when(api.list("access", "folder-1")).thenReturn(List.of(cloud("2", B2)));
        doThrow(new BusinessRuleException("backup.damaged", "The file is not a backup of the portal"))
                .when(backups).adopt(eq(B2), any());

        drive.requestDownload("2");

        assertThat(drive.status().lastError()).isEqualTo("The file is not a backup of the portal");
    }

    @Test
    void withoutAFolderThereIsNothingInTheDrive() {
        store.update(connection -> connection.withClient("id", "secret")
                .connected("refresh", "folder-1", "", clock.instant()));
        store.update(connection -> new DriveConnection(connection.clientId(), connection.clientSecret(),
                connection.refreshToken(), null, null, null, null, null, null));

        assertThat(drive.list()).isEmpty();
    }

    @Test
    void disconnectingRevokesTheTokenAndKeepsTheFolder() {
        drive.disconnect();
        verify(api, never()).revoke(anyString());
        connect();
        doThrow(new DriveException("offline")).when(api).revoke("refresh");

        drive.disconnect();

        assertThat(drive.status().connected()).isFalse();
        assertThat(store.load().folderId()).isEqualTo("folder-1");
        assertThat(store.load().clientId()).isEqualTo("id");
    }

    @Test
    void checksTheConnectionForTheAdministrator() {
        assertThat(drive.checkConnection()).isFalse();
        connect();
        when(api.account("access")).thenReturn("teacher@example.com");

        assertThat(drive.checkConnection()).isTrue();
        when(api.account("access")).thenThrow(new DriveException("offline"));
        assertThatThrownBy(() -> drive.checkConnection()).isInstanceOf(DriveException.class);
    }

    @Test
    void closingStopsTheBackgroundWork() {
        ExecutorService executor = mock(ExecutorService.class);
        new CloudBackupService(api, store, backups, properties(google(null, null)), portal, clock, executor).close();
        drive.close();

        verify(executor).shutdownNow();
    }

    @Test
    void aLongErrorIsShortened() {
        assertThat(DriveConnection.none().failed("x".repeat(2000)).lastError()).hasSize(DriveConnection.MAX_ERROR);
    }

    private void connect() {
        store.update(connection -> connection.withClient("id", "secret")
                .connected("refresh", "folder-1", "teacher@example.com", clock.instant()));
    }

    private CloudBackupService service(BackupProperties.Google google) {
        return new CloudBackupService(api, store, backups, properties(google), portal, clock, Runnable::run);
    }

    private static BackupProperties properties(BackupProperties.Google google) {
        return new BackupProperties("-", 14, false, google);
    }

    private static BackupProperties.Google google(String clientId, String clientSecret) {
        return new BackupProperties.Google(clientId, clientSecret, null, "https://consent", "https://oauth",
                "https://api", "https://upload");
    }

    private static String state(String url) {
        return url.substring(url.indexOf("state=") + "state=".length());
    }

    private static DriveApi.DriveFile cloud(String id, String name) {
        return new DriveApi.DriveFile(id, name, 3, null);
    }

    /** A file uploaded the given number of days ago. */
    private DriveApi.DriveFile cloud(String id, String name, int daysAgo) {
        return new DriveApi.DriveFile(id, name, 3, clock.instant().minus(Duration.ofDays(daysAgo)));
    }

    private static BackupInfo info(String name) {
        return new BackupInfo(name, 3, Instant.parse("2026-10-12T00:30:00Z"), BackupKind.SCHEDULED, "0.12.0");
    }
}

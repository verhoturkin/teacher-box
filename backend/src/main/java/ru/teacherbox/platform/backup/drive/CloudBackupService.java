package ru.teacherbox.platform.backup.drive;

import java.net.URI;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import ru.teacherbox.platform.backup.BackupCreated;
import ru.teacherbox.platform.backup.BackupProperties;
import ru.teacherbox.platform.backup.BackupService;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.ConflictException;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.portal.Portal;

/**
 * Copies of the backups in the teacher's Google Drive (ADR-0037): the connection (OAuth, web server
 * flow), the upload of every scheduled and manual backup into the portal's folder, the rotation there
 * and taking a copy back to the server. Uploads and downloads run one at a time in the background.
 */
public class CloudBackupService implements AutoCloseable {

    /** Path of the OAuth redirect; the teacher registers it in Google Cloud. */
    public static final String CALLBACK_PATH = "/api/public/backups/google/callback";
    static final Duration AUTHORIZATION_TTL = Duration.ofMinutes(10);
    private static final Duration TOKEN_MARGIN = Duration.ofMinutes(1);
    private static final Logger log = LoggerFactory.getLogger(CloudBackupService.class);

    /** What runs in the background. */
    public enum Task {
        UPLOAD,
        /** A copy from the Drive is coming to the server. */
        DOWNLOAD
    }

    /** @param name the backup's file name */
    public record Running(Task task, String name) {
    }

    /**
     * @param clientFromEnvironment the OAuth client comes from environment variables and cannot be changed here
     * @param lastError             why the last upload or download failed, or why the connection was lost
     * @param running               what runs in the background now
     * @param callbackPath          path of the redirect URI to register in Google Cloud
     */
    public record DriveStatus(
            boolean clientConfigured,
            boolean clientFromEnvironment,
            @Nullable String clientId,
            boolean connected,
            @Nullable String account,
            @Nullable Instant connectedAt,
            @Nullable Instant lastUploadAt,
            @Nullable String lastUploadName,
            @Nullable String lastError,
            @Nullable Running running,
            String callbackPath) {
    }

    /** A backup in the Drive. */
    public record CloudBackup(String id, String name, long size, @Nullable Instant createdAt) {
    }

    /** How the OAuth redirect ended. */
    public enum AuthorizationResult {
        CONNECTED,
        /** The teacher declined on Google's consent page. */
        DENIED,
        /** Unknown, used or expired state: start again. */
        EXPIRED,
        FAILED
    }

    private record PendingAuthorization(String redirectUri, Instant expiresAt) {
    }

    private record AccessToken(String value, Instant expiresAt) {
    }

    private final DriveApi api;
    private final DriveConnectionStore store;
    private final BackupService backups;
    private final BackupProperties properties;
    private final Portal portal;
    private final Clock clock;
    private final Executor executor;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, PendingAuthorization> authorizations = new ConcurrentHashMap<>();
    private volatile @Nullable AccessToken accessToken;
    private volatile @Nullable Running running;

    /** @param executor runs uploads and downloads one at a time */
    public CloudBackupService(DriveApi api, DriveConnectionStore store, BackupService backups,
            BackupProperties properties, Portal portal, Clock clock, Executor executor) {
        this.api = api;
        this.store = store;
        this.backups = backups;
        this.properties = properties;
        this.portal = portal;
        this.clock = clock;
        this.executor = executor;
    }

    public DriveStatus status() {
        DriveConnection connection = store.load();
        DriveApi.Client client = client(connection);
        return new DriveStatus(client != null, properties.google().clientFromEnvironment(),
                client == null ? null : client.id(), connection.isConnected(), connection.account(),
                connection.connectedAt(), connection.lastUploadAt(), connection.lastUploadName(),
                connection.lastError(), running, CALLBACK_PATH);
    }

    /** Stores the OAuth client entered in the interface. */
    public void saveClient(String clientId, String clientSecret) {
        if (properties.google().clientFromEnvironment()) {
            throw new BusinessRuleException("backup.google-client-from-environment",
                    "The Google client is set by environment variables");
        }
        String id = clientId.strip();
        String secret = clientSecret.strip();
        if (id.isEmpty() || secret.isEmpty()) {
            throw new BusinessRuleException("backup.google-client-missing", "Enter the client id and secret");
        }
        store.update(connection -> connection.withClient(id, secret));
    }

    /**
     * Starts the authorization: the returned address opens Google's consent page, which then redirects to
     * {@link #CALLBACK_PATH} at the portal address.
     *
     * @param origin address the teacher uses to open the portal; used while the portal address is not set
     */
    public String authorize(String origin) {
        DriveApi.Client client = requireClient(store.load());
        String redirectUri = portal.link(CALLBACK_PATH).orElseGet(() -> origin(origin) + CALLBACK_PATH);
        Instant now = clock.instant();
        authorizations.values().removeIf(pending -> pending.expiresAt().isBefore(now));
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String state = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        authorizations.put(state, new PendingAuthorization(redirectUri, now.plus(AUTHORIZATION_TTL)));
        return api.authorizationUrl(client.id(), redirectUri, state);
    }

    /** Finishes the authorization with Google's answer to the redirect URI. */
    public AuthorizationResult complete(@Nullable String state, @Nullable String code, @Nullable String error) {
        PendingAuthorization pending = state == null ? null : authorizations.remove(state);
        if (pending == null || pending.expiresAt().isBefore(clock.instant())) {
            return AuthorizationResult.EXPIRED;
        }
        if (error != null || code == null || code.isBlank()) {
            return AuthorizationResult.DENIED;
        }
        DriveConnection connection = store.load();
        try {
            DriveApi.Client client = requireClient(connection);
            DriveApi.Tokens tokens = api.exchangeCode(client, code, pending.redirectUri());
            if (tokens.refreshToken() == null) {
                throw new DriveException("Google did not return a refresh token");
            }
            String folderId = connection.folderId() != null
                    && api.folderExists(tokens.accessToken(), connection.folderId())
                    ? connection.folderId()
                    : api.createFolder(tokens.accessToken(), portal.name());
            String account = api.account(tokens.accessToken());
            Instant now = clock.instant();
            store.update(current -> current.connected(tokens.refreshToken(), folderId, account, now));
            accessToken = new AccessToken(tokens.accessToken(), now.plusSeconds(tokens.expiresInSeconds()));
            log.info("Google Drive connected for backups");
            return AuthorizationResult.CONNECTED;
        } catch (DriveException | BusinessRuleException e) {
            log.warn("Google Drive authorization failed: {}", e.getMessage());
            store.update(current -> current.failed(e.getMessage()));
            return AuthorizationResult.FAILED;
        }
    }

    /** Revokes the access; the copies stay in the Drive and the teacher may delete them. */
    public void disconnect() {
        String token = store.load().refreshToken();
        if (token != null) {
            try {
                api.revoke(token);
            } catch (DriveException e) {
                log.warn("Could not revoke the Google Drive token: {}", e.getMessage());
            }
        }
        accessToken = null;
        store.update(connection -> connection.disconnected(null));
    }

    /** Every scheduled and manual backup goes to the Drive once it is connected (not those before a restore or a reset). */
    @EventListener
    public void on(BackupCreated created) {
        if (created.kind().isCopiedToDrive() && store.load().isConnected()) {
            String name = created.backup().name();
            executor.execute(() -> upload(name));
        }
    }

    /** Sends a backup of the server to the Drive in the background. */
    public void requestUpload(String name) {
        requireConnected();
        backups.file(name);
        executor.execute(() -> upload(name));
    }

    /** Backups in the Drive, newest first. */
    public List<CloudBackup> list() {
        DriveConnection connection = requireConnected();
        String folderId = connection.folderId();
        if (folderId == null) {
            return List.of();
        }
        return withToken(connection, token -> api.list(token, folderId)).stream()
                .filter(file -> BackupService.isBackupName(file.name()))
                .map(file -> new CloudBackup(file.id(), file.name(), file.size(), file.createdAt()))
                .toList();
    }

    /**
     * Brings a backup from the Drive to the server in the background; it can then be restored.
     *
     * @throws NotFoundException if the Drive has no such backup
     * @throws ConflictException if the backup is already on the server
     */
    public CloudBackup requestDownload(String id) {
        CloudBackup backup = list().stream().filter(file -> file.id().equals(id)).findFirst()
                .orElseThrow(() -> new NotFoundException("backup.not-found", "Backup not found"));
        if (backups.list().stream().anyMatch(local -> local.name().equals(backup.name()))) {
            throw new ConflictException("backup.exists", "The backup is already on the server");
        }
        executor.execute(() -> download(backup));
        return backup;
    }

    /**
     * For the administrator's integration checks: asks Google about the account (the address itself is not
     * shown to the administrator).
     *
     * @return {@code false} if the Drive is not connected
     * @throws DriveException if Google does not answer or no longer accepts the access
     */
    public boolean checkConnection() {
        DriveConnection connection = store.load();
        if (!connection.isConnected()) {
            return false;
        }
        withToken(connection, api::account);
        return true;
    }

    @Override
    public void close() {
        if (executor instanceof ExecutorService service) {
            service.shutdownNow();
        }
    }

    void upload(String name) {
        running = new Running(Task.UPLOAD, name);
        try {
            DriveConnection connection = store.load();
            if (!connection.isConnected()) {
                return;
            }
            String folderId = withToken(connection, token -> folder(token, connection));
            withToken(connection, token -> api.upload(token, folderId, backups.file(name)));
            store.update(current -> current.uploaded(name, clock.instant()));
            log.info("Backup {} uploaded to Google Drive", name);
            rotate(connection, folderId);
        } catch (DriveException | NotFoundException e) {
            failed("upload of " + name, e);
        } finally {
            running = null;
        }
    }

    private void download(CloudBackup backup) {
        running = new Running(Task.DOWNLOAD, backup.name());
        try {
            DriveConnection connection = store.load();
            backups.adopt(backup.name(),
                    partial -> withToken(connection, token -> {
                        api.download(token, backup.id(), partial);
                        return partial;
                    }));
            store.update(current -> current.failed(null));
        } catch (DriveException | BusinessRuleException | ConflictException e) {
            failed("download of " + backup.name(), e);
        } finally {
            running = null;
        }
    }

    /** Backups older than {@link BackupProperties#keepDays()} are deleted from the folder. */
    private void rotate(DriveConnection connection, String folderId) {
        Instant oldest = clock.instant().minus(properties.retention());
        List<DriveApi.DriveFile> old = withToken(connection, token -> api.list(token, folderId)).stream()
                .filter(file -> BackupService.isBackupName(file.name()))
                .filter(file -> file.createdAt() != null && file.createdAt().isBefore(oldest))
                .toList();
        for (DriveApi.DriveFile file : old) {
            withToken(connection, token -> {
                api.delete(token, file.id());
                return file;
            });
            log.info("Old backup {} deleted from Google Drive", file.name());
        }
    }

    /** The portal's folder; made again if the teacher deleted it. */
    private String folder(String token, DriveConnection connection) {
        String folderId = connection.folderId();
        if (folderId != null && api.folderExists(token, folderId)) {
            return folderId;
        }
        String created = api.createFolder(token, portal.name());
        store.update(current -> current.withFolder(created));
        return created;
    }

    private void failed(String action, RuntimeException e) {
        log.warn("Google Drive {} failed: {}", action, e.getMessage());
        if (e instanceof DriveAuthException) {
            accessToken = null;
            store.update(current -> current.disconnected(e.getMessage()));
        } else {
            store.update(current -> current.failed(e.getMessage()));
        }
    }

    private interface WithToken<T> {
        T run(String accessToken);
    }

    /** Runs the call with a fresh access token; a rejected token is refreshed and the call made once more. */
    private <T> T withToken(DriveConnection connection, WithToken<T> call) {
        AccessToken token = accessToken;
        if (token == null || token.expiresAt().minus(TOKEN_MARGIN).isBefore(clock.instant())) {
            token = refresh(connection);
        }
        try {
            return call.run(token.value());
        } catch (DriveAuthException e) {
            return call.run(refresh(connection).value());
        }
    }

    private AccessToken refresh(DriveConnection connection) {
        String refreshToken = connection.refreshToken();
        if (refreshToken == null) {
            throw new DriveAuthException("Google Drive is not connected");
        }
        DriveApi.Tokens tokens = api.refresh(requireClient(connection), refreshToken);
        AccessToken token = new AccessToken(tokens.accessToken(), clock.instant().plusSeconds(tokens.expiresInSeconds()));
        accessToken = token;
        return token;
    }

    private DriveConnection requireConnected() {
        DriveConnection connection = store.load();
        if (!connection.isConnected()) {
            throw new BusinessRuleException("backup.google-not-connected", "Google Drive is not connected");
        }
        return connection;
    }

    private DriveApi.@Nullable Client client(DriveConnection connection) {
        BackupProperties.Google google = properties.google();
        if (google.clientFromEnvironment()) {
            return new DriveApi.Client(String.valueOf(google.clientId()).strip(),
                    String.valueOf(google.clientSecret()).strip());
        }
        String id = connection.clientId();
        String secret = connection.clientSecret();
        return id == null || secret == null ? null : new DriveApi.Client(id, secret);
    }

    private DriveApi.Client requireClient(DriveConnection connection) {
        DriveApi.Client client = client(connection);
        if (client == null) {
            throw new BusinessRuleException("backup.google-client-missing", "Enter the client id and secret");
        }
        return client;
    }

    /** Only the scheme, host and port of the address the teacher opened the portal with. */
    private static String origin(String origin) {
        URI uri;
        try {
            uri = URI.create(origin.strip());
        } catch (IllegalArgumentException e) {
            throw invalidOrigin();
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https") || uri.getHost() == null) {
            throw invalidOrigin();
        }
        return scheme + "://" + uri.getHost() + (uri.getPort() == -1 ? "" : ":" + uri.getPort());
    }

    private static BusinessRuleException invalidOrigin() {
        return new BusinessRuleException("backup.google-origin-invalid", "The portal address is not valid");
    }
}

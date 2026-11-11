package ru.teacherbox.platform.backup.drive;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import ru.teacherbox.shared.http.GoogleOAuth.Client;
import ru.teacherbox.shared.http.GoogleOAuth.Tokens;
import ru.teacherbox.shared.http.GoogleOAuth;
import tools.jackson.databind.JsonNode;

/**
 * Google OAuth 2.0 (authorization code flow for web server applications) and the few Drive v3 calls the
 * backups need (ADR-0037). The scope {@code drive.file} shows the portal only the files it created.
 */
public class DriveApi {

    /** Files the app created or the user opened with it. */
    public static final String SCOPE = "https://www.googleapis.com/auth/drive.file";
    static final String FOLDER_TYPE = "application/vnd.google-apps.folder";
    private static final String ZIP = "application/zip";

    /** A file in the portal's folder. */
    public record DriveFile(String id, String name, long size, @Nullable Instant createdAt) {
    }

    private final GoogleOAuth oauth;
    private final RestClient api;
    private final RestClient files;
    private final String apiUrl;
    private final String uploadUrl;

    /**
     * @param oauth     client with the base address of the token and revoke endpoints
     * @param api       client with the base address of the Drive API
     * @param files     client for uploads and downloads: long timeouts, bodies streamed, not buffered
     * @param apiUrl    base address of the Drive API (downloads)
     * @param uploadUrl base address of the Drive uploads
     */
    public DriveApi(RestClient oauth, RestClient api, RestClient files, String authorizationUrl, String apiUrl,
            String uploadUrl) {
        this.oauth = new GoogleOAuth(oauth, authorizationUrl, DriveException::new, DriveAuthException::new);
        this.api = api;
        this.files = files;
        this.apiUrl = apiUrl;
        this.uploadUrl = uploadUrl;
    }

    /** The consent page; {@code prompt=consent} makes Google return a refresh token every time. */
    public String authorizationUrl(String clientId, String redirectUri, String state) {
        return oauth.authorizationUrl(clientId, redirectUri, SCOPE, state);
    }

    public Tokens exchangeCode(Client client, String code, String redirectUri) {
        return oauth.exchangeCode(client, code, redirectUri);
    }

    /** @throws DriveAuthException if the refresh token is revoked or expired */
    public Tokens refresh(Client client, String refreshToken) {
        return oauth.refresh(client, refreshToken);
    }

    /** Withdraws the app's access; a token that is already invalid is fine. */
    public void revoke(String token) {
        oauth.revoke(token);
    }

    /** The address of the Google account; empty if Google does not tell it. */
    public String account(String accessToken) {
        JsonNode about = oauth.call("about", () -> api.get()
                .uri("/about?fields=user(emailAddress)")
                .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                .retrieve()
                .body(JsonNode.class));
        return about == null ? "" : about.path("user").path("emailAddress").asString("");
    }

    /** @return id of the new folder */
    public String createFolder(String accessToken, String name) {
        JsonNode created = oauth.call("create folder", () -> api.post()
                .uri("/files?fields=id")
                .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("name", name, "mimeType", FOLDER_TYPE))
                .retrieve()
                .body(JsonNode.class));
        String id = created == null ? "" : created.path("id").asString("");
        if (id.isEmpty()) {
            throw new DriveException("Google did not return the id of the new folder");
        }
        return id;
    }

    /** Whether the folder is there and not in the trash. */
    public boolean folderExists(String accessToken, String folderId) {
        try {
            JsonNode folder = api.get()
                    .uri("/files/{id}?fields=id,trashed", folderId)
                    .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                    .retrieve()
                    .body(JsonNode.class);
            return folder != null && !folder.path("trashed").asBoolean(false);
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == HttpStatus.NOT_FOUND.value()) {
                return false;
            }
            throw oauth.failure("get folder", e);
        } catch (RestClientException e) {
            throw new DriveException("Google get folder: " + e.getMessage());
        }
    }

    /** The zip files in the folder, newest name first. */
    public List<DriveFile> list(String accessToken, String folderId) {
        List<DriveFile> found = new ArrayList<>();
        String pageToken = null;
        do {
            String token = pageToken;
            JsonNode page = oauth.call("list files", () -> api.get()
                    .uri(uri -> {
                        uri.path("/files")
                                .queryParam("q", "{q}")
                                .queryParam("orderBy", "name desc")
                                .queryParam("pageSize", 100)
                                .queryParam("fields", "nextPageToken,files(id,name,size,createdTime)");
                        if (token != null) {
                            uri.queryParam("pageToken", "{pageToken}");
                        }
                        return uri.build(token == null
                                ? Map.of("q", query(folderId))
                                : Map.of("q", query(folderId), "pageToken", token));
                    })
                    .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                    .retrieve()
                    .body(JsonNode.class));
            if (page == null) {
                break;
            }
            for (JsonNode file : page.path("files")) {
                String created = file.path("createdTime").asString("");
                found.add(new DriveFile(file.path("id").asString(), file.path("name").asString(),
                        file.path("size").asLong(0), created.isEmpty() ? null : Instant.parse(created)));
            }
            String next = page.path("nextPageToken").asString("");
            pageToken = next.isEmpty() ? null : next;
        } while (pageToken != null);
        return found;
    }

    /**
     * Uploads a zip file into the folder: a resumable upload session, then the whole file in one request,
     * streamed from the disk.
     *
     * @return id of the new file
     */
    public String upload(String accessToken, String folderId, Path file) {
        long size = size(file);
        URI session = oauth.call("start upload", () -> files.post()
                .uri(uploadUrl + "/files?uploadType=resumable&fields=id")
                .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                .header("X-Upload-Content-Type", ZIP)
                .header("X-Upload-Content-Length", Long.toString(size))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("name", file.getFileName().toString(), "parents", List.of(folderId),
                        "mimeType", ZIP))
                .retrieve()
                .toBodilessEntity()
                .getHeaders()
                .getLocation());
        if (session == null) {
            throw new DriveException("Google did not return the upload address");
        }
        JsonNode uploaded = oauth.call("upload", () -> files.put()
                .uri(session)
                .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                .contentType(MediaType.parseMediaType(ZIP))
                .contentLength(size)
                .body(new FileSystemResource(file))
                .retrieve()
                .body(JsonNode.class));
        String id = uploaded == null ? "" : uploaded.path("id").asString("");
        if (id.isEmpty()) {
            throw new DriveException("Google did not return the id of the uploaded file");
        }
        return id;
    }

    /** Streams the file's content into {@code target}. */
    public void download(String accessToken, String fileId, Path target) {
        oauth.call("download", () -> files.get()
                .uri(apiUrl + "/files/{id}?alt=media", fileId)
                .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                .exchange((request, response) -> {
                    int status = response.getStatusCode().value();
                    if (response.getStatusCode().isError()) {
                        throw oauth.failure("download", status,
                                GoogleOAuth.describe(body(response.getBody()), response.getStatusText()));
                    }
                    Files.copy(response.getBody(), target, StandardCopyOption.REPLACE_EXISTING);
                    return target;
                }));
    }

    /** Deletes a file; one that is already gone is fine. */
    public void delete(String accessToken, String fileId) {
        try {
            api.delete()
                    .uri("/files/{id}", fileId)
                    .header(HttpHeaders.AUTHORIZATION, GoogleOAuth.bearer(accessToken))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() != HttpStatus.NOT_FOUND.value()) {
                throw oauth.failure("delete file", e);
            }
        } catch (RestClientException e) {
            throw new DriveException("Google delete file: " + e.getMessage());
        }
    }

    private static String query(String folderId) {
        return "'" + folderId.replace("\\", "\\\\").replace("'", "\\'") + "' in parents and trashed = false"
                + " and mimeType = '" + ZIP + "'";
    }

    private static long size(Path file) {
        try {
            return Files.size(file);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static byte[] body(InputStream in) {
        try {
            return in.readNBytes(10_000);
        } catch (IOException e) {
            return new byte[0];
        }
    }
}

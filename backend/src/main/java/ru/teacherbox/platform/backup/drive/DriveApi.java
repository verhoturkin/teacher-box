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
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Google OAuth 2.0 (authorization code flow for web server applications) and the few Drive v3 calls the
 * backups need (ADR-0037). The scope {@code drive.file} shows the portal only the files it created.
 */
public class DriveApi {

    /** Files the app created or the user opened with it. */
    public static final String SCOPE = "https://www.googleapis.com/auth/drive.file";
    static final String FOLDER_TYPE = "application/vnd.google-apps.folder";
    private static final String ZIP = "application/zip";

    /** OAuth client of the teacher's Google Cloud project. */
    public record Client(String id, String secret) {
    }

    /** @param refreshToken returned when the user consents (offline access) */
    public record Tokens(String accessToken, long expiresInSeconds, @Nullable String refreshToken) {
    }

    /** A file in the portal's folder. */
    public record DriveFile(String id, String name, long size, @Nullable Instant createdAt) {
    }

    private final RestClient oauth;
    private final RestClient api;
    private final RestClient files;
    private final String authorizationUrl;
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
        this.oauth = oauth;
        this.api = api;
        this.files = files;
        this.authorizationUrl = authorizationUrl;
        this.apiUrl = apiUrl;
        this.uploadUrl = uploadUrl;
    }

    /** The consent page; {@code prompt=consent} makes Google return a refresh token every time. */
    public String authorizationUrl(String clientId, String redirectUri, String state) {
        return UriComponentsBuilder.fromUriString(authorizationUrl)
                .queryParam("client_id", "{clientId}")
                .queryParam("redirect_uri", "{redirectUri}")
                .queryParam("response_type", "code")
                .queryParam("scope", "{scope}")
                .queryParam("access_type", "offline")
                .queryParam("prompt", "consent")
                .queryParam("state", "{state}")
                .encode()
                .buildAndExpand(Map.of("clientId", clientId, "redirectUri", redirectUri, "scope", SCOPE,
                        "state", state))
                .toUriString();
    }

    public Tokens exchangeCode(Client client, String code, String redirectUri) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", code);
        form.add("client_id", client.id());
        form.add("client_secret", client.secret());
        form.add("redirect_uri", redirectUri);
        form.add("grant_type", "authorization_code");
        return tokens(form);
    }

    /** @throws DriveAuthException if the refresh token is revoked or expired */
    public Tokens refresh(Client client, String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", client.id());
        form.add("client_secret", client.secret());
        form.add("refresh_token", refreshToken);
        form.add("grant_type", "refresh_token");
        return tokens(form);
    }

    /** Withdraws the app's access; a token that is already invalid is fine. */
    public void revoke(String token) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("token", token);
        try {
            oauth.post().uri("/revoke").contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() != HttpStatus.BAD_REQUEST.value()) {
                throw failure("revoke", e);
            }
        } catch (RestClientException e) {
            throw new DriveException("Google revoke: " + e.getMessage());
        }
    }

    /** The address of the Google account; empty if Google does not tell it. */
    public String account(String accessToken) {
        JsonNode about = call("about", () -> api.get()
                .uri("/about?fields=user(emailAddress)")
                .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                .retrieve()
                .body(JsonNode.class));
        return about == null ? "" : about.path("user").path("emailAddress").asString("");
    }

    /** @return id of the new folder */
    public String createFolder(String accessToken, String name) {
        JsonNode created = call("create folder", () -> api.post()
                .uri("/files?fields=id")
                .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
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
                    .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                    .retrieve()
                    .body(JsonNode.class);
            return folder != null && !folder.path("trashed").asBoolean(false);
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == HttpStatus.NOT_FOUND.value()) {
                return false;
            }
            throw failure("get folder", e);
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
            JsonNode page = call("list files", () -> api.get()
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
                    .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
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
        URI session = call("start upload", () -> files.post()
                .uri(uploadUrl + "/files?uploadType=resumable&fields=id")
                .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
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
        JsonNode uploaded = call("upload", () -> files.put()
                .uri(session)
                .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
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
        call("download", () -> files.get()
                .uri(apiUrl + "/files/{id}?alt=media", fileId)
                .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                .exchange((request, response) -> {
                    int status = response.getStatusCode().value();
                    if (response.getStatusCode().isError()) {
                        String message = "Google download " + status + ": "
                                + describe(body(response.getBody()), response.getStatusText());
                        throw status == HttpStatus.UNAUTHORIZED.value()
                                ? new DriveAuthException(message)
                                : new DriveException(message);
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
                    .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() != HttpStatus.NOT_FOUND.value()) {
                throw failure("delete file", e);
            }
        } catch (RestClientException e) {
            throw new DriveException("Google delete file: " + e.getMessage());
        }
    }

    private Tokens tokens(MultiValueMap<String, String> form) {
        JsonNode response;
        try {
            response = oauth.post()
                    .uri("/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            if ("invalid_grant".equals(errorCode(e))) {
                throw new DriveAuthException("Google refused the authorization: " + describe(e));
            }
            throw failure("token", e);
        } catch (RestClientException e) {
            throw new DriveException("Google token: " + e.getMessage());
        }
        String accessToken = response == null ? "" : response.path("access_token").asString("");
        if (response == null || accessToken.isEmpty()) {
            throw new DriveException("Google did not return an access token");
        }
        String refreshToken = response.path("refresh_token").asString("");
        return new Tokens(accessToken, response.path("expires_in").asLong(3600),
                refreshToken.isEmpty() ? null : refreshToken);
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

    private interface Call<T> {
        @Nullable T run();
    }

    private static <T> @Nullable T call(String action, Call<T> call) {
        try {
            return call.run();
        } catch (RestClientResponseException e) {
            throw failure(action, e);
        } catch (RestClientException | UncheckedIOException e) {
            throw new DriveException("Google " + action + ": " + e.getMessage());
        }
    }

    private static DriveException failure(String action, RestClientResponseException e) {
        String message = "Google " + action + " " + e.getStatusCode().value() + ": " + describe(e);
        return e.getStatusCode().value() == HttpStatus.UNAUTHORIZED.value()
                ? new DriveAuthException(message)
                : new DriveException(message);
    }

    private static @Nullable String errorCode(RestClientResponseException e) {
        try {
            JsonNode body = e.getResponseBodyAs(JsonNode.class);
            JsonNode error = body == null ? null : body.path("error");
            return error == null || !error.isString() ? null : error.asString();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    /** The error text of Google's JSON error body (OAuth or API format), or the status text. */
    private static String describe(RestClientResponseException e) {
        return describe(e.getResponseBodyAsByteArray(), e.getStatusText());
    }

    private static String describe(byte[] response, String statusText) {
        try {
            JsonNode body = response.length == 0 ? null : JsonMapper.shared().readTree(response);
            if (body != null) {
                JsonNode error = body.path("error");
                if (error.isString()) {
                    String description = body.path("error_description").asString("");
                    return description.isEmpty() ? error.asString() : error.asString() + " (" + description + ")";
                }
                if (error.has("message")) {
                    return error.path("message").asString();
                }
            }
        } catch (RuntimeException ignored) {
            // not a JSON error body
        }
        return statusText;
    }

    private static String bearer(String accessToken) {
        return "Bearer " + accessToken;
    }
}

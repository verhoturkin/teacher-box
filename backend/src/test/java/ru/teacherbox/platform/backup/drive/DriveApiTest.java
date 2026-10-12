package ru.teacherbox.platform.backup.drive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/** Google OAuth and Drive API calls against a mock server. */
class DriveApiTest {

    private static final String OAUTH = "https://oauth2.googleapis.com";
    private static final String API = "https://www.googleapis.com/drive/v3";
    private static final String UPLOAD = "https://www.googleapis.com/upload/drive/v3";
    private static final DriveApi.Client CLIENT = new DriveApi.Client("client-id", "client-secret");

    private final RestClient.Builder oauthBuilder = RestClient.builder().baseUrl(OAUTH);
    private final RestClient.Builder apiBuilder = RestClient.builder().baseUrl(API);
    private final RestClient.Builder filesBuilder = RestClient.builder();
    private final MockRestServiceServer oauth = MockRestServiceServer.bindTo(oauthBuilder).build();
    private final MockRestServiceServer api = MockRestServiceServer.bindTo(apiBuilder).build();
    private final MockRestServiceServer files = MockRestServiceServer.bindTo(filesBuilder).build();
    private final DriveApi drive = new DriveApi(oauthBuilder.build(), apiBuilder.build(), filesBuilder.build(),
            "https://accounts.google.com/o/oauth2/v2/auth", API, UPLOAD);

    @Test
    void buildsTheConsentAddress() {
        String url = drive.authorizationUrl("client-id", "https://school.example.com/api/public/backups/google/callback",
                "state-1");

        var params = UriComponentsBuilder.fromUriString(url).build(true).getQueryParams();
        assertThat(url).startsWith("https://accounts.google.com/o/oauth2/v2/auth?");
        assertThat(params.getFirst("client_id")).isEqualTo("client-id");
        assertThat(params.getFirst("redirect_uri"))
                .isEqualTo("https%3A%2F%2Fschool.example.com%2Fapi%2Fpublic%2Fbackups%2Fgoogle%2Fcallback");
        assertThat(params.getFirst("scope")).isEqualTo("https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file");
        assertThat(params.getFirst("access_type")).isEqualTo("offline");
        assertThat(params.getFirst("prompt")).isEqualTo("consent");
        assertThat(params.getFirst("state")).isEqualTo("state-1");
    }

    @Test
    void exchangesTheCodeAndRefreshesTokens() {
        oauth.expect(requestTo(OAUTH + "/token"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().formDataContains(Map.of("code", "code-1", "grant_type", "authorization_code",
                        "redirect_uri", "https://school/cb", "client_id", "client-id", "client_secret", "client-secret")))
                .andRespond(withSuccess("""
                        {"access_token": "access-1", "expires_in": 3599, "refresh_token": "refresh-1"}
                        """, MediaType.APPLICATION_JSON));
        oauth.expect(requestTo(OAUTH + "/token"))
                .andExpect(content().formDataContains(Map.of("grant_type", "refresh_token",
                        "refresh_token", "refresh-1")))
                .andRespond(withSuccess("{\"access_token\": \"access-2\"}", MediaType.APPLICATION_JSON));

        assertThat(drive.exchangeCode(CLIENT, "code-1", "https://school/cb"))
                .isEqualTo(new DriveApi.Tokens("access-1", 3599, "refresh-1"));
        assertThat(drive.refresh(CLIENT, "refresh-1")).isEqualTo(new DriveApi.Tokens("access-2", 3600, null));
        oauth.verify();
    }

    @Test
    void tokenErrors() {
        oauth.expect(requestTo(OAUTH + "/token")).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"error\": \"invalid_grant\", \"error_description\": \"Token has been expired or revoked.\"}"));
        oauth.expect(requestTo(OAUTH + "/token")).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON).body("{\"error\": \"invalid_client\"}"));
        oauth.expect(requestTo(OAUTH + "/token")).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        oauth.expect(requestTo(OAUTH + "/token")).andRespond(withException(new IOException("timeout")));

        assertThatThrownBy(() -> drive.refresh(CLIENT, "r")).isInstanceOf(DriveAuthException.class)
                .hasMessageContaining("invalid_grant (Token has been expired or revoked.)");
        assertThatThrownBy(() -> drive.refresh(CLIENT, "r")).isExactlyInstanceOf(DriveException.class)
                .hasMessageContaining("400: invalid_client");
        assertThatThrownBy(() -> drive.refresh(CLIENT, "r")).hasMessageContaining("did not return an access token");
        assertThatThrownBy(() -> drive.refresh(CLIENT, "r")).isExactlyInstanceOf(DriveException.class)
                .hasMessageContaining("timeout");
    }

    @Test
    void revokesAToken() {
        oauth.expect(requestTo(OAUTH + "/revoke")).andRespond(withSuccess());
        oauth.expect(requestTo(OAUTH + "/revoke")).andRespond(withStatus(HttpStatus.BAD_REQUEST));
        oauth.expect(requestTo(OAUTH + "/revoke")).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        oauth.expect(requestTo(OAUTH + "/revoke")).andRespond(withException(new IOException("down")));

        drive.revoke("t");
        drive.revoke("already-invalid");
        assertThatThrownBy(() -> drive.revoke("t")).hasMessageContaining("503");
        assertThatThrownBy(() -> drive.revoke("t")).hasMessageContaining("down");
    }

    @Test
    void tellsTheAccountAndMakesTheFolder() {
        api.expect(requestTo(API + "/about?fields=user(emailAddress)"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer a"))
                .andRespond(withSuccess("{\"user\": {\"emailAddress\": \"teacher@example.com\"}}",
                        MediaType.APPLICATION_JSON));
        api.expect(requestTo(API + "/files?fields=id"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.name").value("Школа"))
                .andExpect(jsonPath("$.mimeType").value(DriveApi.FOLDER_TYPE))
                .andRespond(withSuccess("{\"id\": \"folder-1\"}", MediaType.APPLICATION_JSON));
        api.expect(requestTo(API + "/files?fields=id")).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        api.expect(requestTo(API + "/files/folder-1?fields=id,trashed"))
                .andRespond(withSuccess("{\"id\": \"folder-1\", \"trashed\": false}", MediaType.APPLICATION_JSON));
        api.expect(requestTo(API + "/files/folder-1?fields=id,trashed"))
                .andRespond(withSuccess("{\"id\": \"folder-1\", \"trashed\": true}", MediaType.APPLICATION_JSON));
        api.expect(requestTo(API + "/files/folder-1?fields=id,trashed")).andRespond(withStatus(HttpStatus.NOT_FOUND));
        api.expect(requestTo(API + "/files/folder-1?fields=id,trashed")).andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                .contentType(MediaType.APPLICATION_JSON).body("{\"error\": {\"message\": \"Invalid Credentials\"}}"));
        api.expect(requestTo(API + "/files/folder-1?fields=id,trashed")).andRespond(withException(new IOException("x")));

        assertThat(drive.account("a")).isEqualTo("teacher@example.com");
        assertThat(drive.createFolder("a", "Школа")).isEqualTo("folder-1");
        assertThatThrownBy(() -> drive.createFolder("a", "Школа")).hasMessageContaining("id of the new folder");
        assertThat(drive.folderExists("a", "folder-1")).isTrue();
        assertThat(drive.folderExists("a", "folder-1")).as("in the trash").isFalse();
        assertThat(drive.folderExists("a", "folder-1")).isFalse();
        assertThatThrownBy(() -> drive.folderExists("a", "folder-1")).isInstanceOf(DriveAuthException.class)
                .hasMessageContaining("401: Invalid Credentials");
        assertThatThrownBy(() -> drive.folderExists("a", "folder-1")).isExactlyInstanceOf(DriveException.class);
        api.verify();
    }

    @Test
    void listsTheFolderPageByPage() {
        api.expect(requestTo(org.hamcrest.Matchers.startsWith(API + "/files?")))
                .andExpect(queryParam("q", "%27f%5C%271%27%20in%20parents%20and%20trashed%20%3D%20false"
                        + "%20and%20mimeType%20%3D%20%27application%2Fzip%27"))
                .andExpect(queryParam("orderBy", "name%20desc"))
                .andRespond(withSuccess("""
                        {"nextPageToken": "p2", "files": [{"id": "1", "name": "teacherbox-20261012-033000-000.zip",
                         "size": "120", "createdTime": "2026-10-12T00:30:01.000Z"}]}
                        """, MediaType.APPLICATION_JSON));
        api.expect(requestTo(org.hamcrest.Matchers.containsString("pageToken=p2")))
                .andRespond(withSuccess("{\"files\": [{\"id\": \"2\", \"name\": \"other.zip\"}]}",
                        MediaType.APPLICATION_JSON));

        assertThat(drive.list("a", "f'1")).containsExactly(
                new DriveApi.DriveFile("1", "teacherbox-20261012-033000-000.zip", 120,
                        Instant.parse("2026-10-12T00:30:01Z")),
                new DriveApi.DriveFile("2", "other.zip", 0, null));
        api.verify();
    }

    @Test
    void uploadsAFileThroughAnUploadSession(@TempDir Path dir) throws IOException {
        Path file = dir.resolve("teacherbox-20261012-033000-000.zip");
        Files.writeString(file, "zip content");
        HttpHeaders location = new HttpHeaders();
        location.setLocation(URI.create(UPLOAD + "/files?uploadType=resumable&upload_id=s1"));
        files.expect(requestTo(UPLOAD + "/files?uploadType=resumable&fields=id"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("X-Upload-Content-Type", "application/zip"))
                .andExpect(header("X-Upload-Content-Length", "11"))
                .andExpect(jsonPath("$.name").value("teacherbox-20261012-033000-000.zip"))
                .andExpect(jsonPath("$.parents[0]").value("folder-1"))
                .andRespond(withSuccess().headers(location));
        files.expect(requestTo(UPLOAD + "/files?uploadType=resumable&upload_id=s1"))
                .andExpect(method(HttpMethod.PUT))
                .andExpect(header(HttpHeaders.CONTENT_LENGTH, "11"))
                .andExpect(content().string("zip content"))
                .andRespond(withSuccess("{\"id\": \"file-1\"}", MediaType.APPLICATION_JSON));
        files.expect(requestTo(UPLOAD + "/files?uploadType=resumable&fields=id")).andRespond(withSuccess());
        files.expect(requestTo(UPLOAD + "/files?uploadType=resumable&fields=id")).andRespond(withSuccess().headers(location));
        files.expect(requestTo(UPLOAD + "/files?uploadType=resumable&upload_id=s1"))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        assertThat(drive.upload("a", "folder-1", file)).isEqualTo("file-1");
        assertThatThrownBy(() -> drive.upload("a", "folder-1", file)).hasMessageContaining("upload address");
        assertThatThrownBy(() -> drive.upload("a", "folder-1", file)).hasMessageContaining("uploaded file");
        assertThatThrownBy(() -> drive.upload("a", "folder-1", dir.resolve("missing.zip")))
                .isInstanceOf(java.io.UncheckedIOException.class);
        files.verify();
    }

    @Test
    void downloadsAndDeletesFiles(@TempDir Path dir) throws IOException {
        files.expect(requestTo(API + "/files/file-1?alt=media"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer a"))
                .andRespond(withSuccess("zip content".getBytes(StandardCharsets.UTF_8),
                        MediaType.APPLICATION_OCTET_STREAM));
        files.expect(requestTo(API + "/files/file-2?alt=media")).andRespond(withStatus(HttpStatus.NOT_FOUND)
                .contentType(MediaType.APPLICATION_JSON).body("{\"error\": {\"message\": \"File not found\"}}"));
        api.expect(requestTo(API + "/files/file-1")).andExpect(method(HttpMethod.DELETE)).andRespond(withSuccess());
        api.expect(requestTo(API + "/files/file-1")).andRespond(withStatus(HttpStatus.NOT_FOUND));
        api.expect(requestTo(API + "/files/file-1")).andRespond(withStatus(HttpStatus.FORBIDDEN));
        api.expect(requestTo(API + "/files/file-1")).andRespond(withException(new IOException("x")));

        drive.download("a", "file-1", dir.resolve("copy.zip"));
        assertThat(dir.resolve("copy.zip")).hasContent("zip content");
        assertThatThrownBy(() -> drive.download("a", "file-2", dir.resolve("other.zip")))
                .hasMessageContaining("404: File not found");
        drive.delete("a", "file-1");
        drive.delete("a", "file-1");
        assertThatThrownBy(() -> drive.delete("a", "file-1")).hasMessageContaining("403");
        assertThatThrownBy(() -> drive.delete("a", "file-1")).isExactlyInstanceOf(DriveException.class);
        files.verify();
        api.verify();
    }

    @Test
    void anUnexpectedErrorBodyFallsBackToTheStatusText() {
        api.expect(ExpectedCount.once(), requestTo(API + "/about?fields=user(emailAddress)"))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR).body("not json"));

        assertThatThrownBy(() -> drive.account("a")).hasMessageContaining("500");
    }
}
